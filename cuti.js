// cuti.js

// Konfigurasi Supabase Anda
const SUPABASE_URL = 'https://nvtedibubuiykovrtfiv.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dGVkaWJ1YnVpeWtvdnJ0Zml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTk5MzQsImV4cCI6MjA2Nzc3NTkzNH0.s5-CtQuXYAf1hQcRwljYhROibzm9U65XGxtD7LJeNVU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Mendapatkan referensi elemen DOM
const leaveForm = document.getElementById('leave-form');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const reasonInput = document.getElementById('reason');
const submitButton = leaveForm.querySelector('button[type="submit"]'); // Tombol Ajukan Cuti
const statusMessageDiv = document.getElementById('status-message');

let currentEmployee = null; // Untuk menyimpan data karyawan yang sedang login

// Fungsi untuk menampilkan pesan status
function showMessage(message, isError = false) {
    if (!statusMessageDiv) return;
    statusMessageDiv.textContent = message;
    statusMessageDiv.className = `mb-4 p-4 text-sm rounded-lg ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
    statusMessageDiv.classList.remove('hidden');
    if (!isError) {
        setTimeout(() => {
            statusMessageDiv.classList.add('hidden');
        }, 5000);
    }
}

// Fungsi untuk memverifikasi pengguna dan mengambil data karyawan
async function verifyUserAndLoadEmployee() {
    console.log("Verifying user session for leave form..."); // Debugging
    try {
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        console.log("VerifyUserAndLoadEmployee - Session:", session); // Debugging
        if (sessionError) {
            console.error("VerifyUserAndLoadEmployee - Error getting session:", sessionError);
            showMessage("Gagal memverifikasi sesi. Mohon login ulang.", true);
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            return false;
        }
        if (!session) {
            console.log("VerifyUserAndLoadEmployee - No session found, redirecting to login.");
            showMessage("Anda belum login. Mengarahkan ke halaman login...", true);
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            return false;
        }

        console.log("VerifyUserAndLoadEmployee - Logged in user email:", session.user.email); // Debugging
        
        // Ambil data karyawan berdasarkan email yang login
        // Menggunakan nama_lengkap sesuai skema
        const { data: employeeDataArray, error: employeeError } = await supabaseClient
            .from('employees')
            .select('id, nama_lengkap, email') // Hanya ambil kolom yang relevan
            .eq('email', session.user.email)
            .limit(1); // Menggunakan limit(1) untuk menghindari error .single()

        const employeeData = employeeDataArray && employeeDataArray.length > 0 ? employeeDataArray[0] : null;

        console.log("VerifyUserAndLoadEmployee - Raw response from DB:", employeeDataArray); // Debugging
        console.log("VerifyUserAndLoadEmployee - Employee Data for leave form:", employeeData); // Debugging
        console.log("VerifyUserAndLoadEmployee - Employee Error for leave form:", employeeError); // Debugging

        if (employeeError) {
            console.error("VerifyUserAndLoadEmployee - Error fetching employee data for leave form:", employeeError);
            showMessage(`Gagal memverifikasi data karyawan: ${employeeError.message}`, true);
            return false;
        }
        if (!employeeData) {
            console.log("VerifyUserAndLoadEmployee - No employee data found for this user."); // Debugging
            showMessage("Profil karyawan tidak ditemukan. Pastikan email Anda terdaftar di tabel karyawan.", true);
            return false;
        }

        currentEmployee = employeeData;
        showMessage(`Selamat datang, ${currentEmployee.nama_lengkap}! Silakan ajukan cuti.`, false);
        return true;

    } catch (e) {
        console.error("VerifyUserAndLoadEmployee - Caught error in verifyUserAndLoadEmployee:", e);
        showMessage(`Terjadi kesalahan saat memverifikasi pengguna: ${e.message}`, true);
        return false;
    }
}

// Event listener untuk pengajuan formulir cuti
leaveForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Mencegah refresh halaman

    if (!currentEmployee) {
        showMessage("Data karyawan belum dimuat. Mohon refresh halaman.", true);
        return;
    }

    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    const reason = reasonInput.value.trim();

    // Validasi input
    if (!startDate || !endDate || !reason) {
        showMessage("Harap isi semua kolom yang diperlukan.", true);
        return;
    }
    if (new Date(startDate) > new Date(endDate)) {
        showMessage("Tanggal mulai tidak boleh lebih dari tanggal selesai.", true);
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Mengajukan...';
    showMessage('Mengajukan cuti Anda...', false);
    console.log("Submitting leave request..."); // Debugging

    try {
        // Simpan pengajuan cuti ke tabel 'leave_requests'
        // Status awal 'Pending'
        const { error } = await supabaseClient
            .from('leave_requests')
            .insert({
                employee_id: currentEmployee.id,
                start_date: startDate,
                end_date: endDate,
                reason: reason,
                status: 'Pending' // Status default untuk pengajuan baru
            });

        if (error) {
            throw error;
        }

        showMessage("Pengajuan cuti berhasil diajukan! Menunggu persetujuan.", false);
        console.log("Leave request submitted successfully."); // Debugging
        // Opsional: Reset form setelah berhasil
        leaveForm.reset();
        // Opsional: Kembali ke dashboard setelah beberapa detik
        setTimeout(() => { window.location.href = 'index.html'; }, 3000);

    } catch (e) {
        console.error("Error submitting leave request:", e); // Debugging
        showMessage(`Gagal mengajukan cuti: ${e.message}`, true);
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Ajukan Cuti';
    }
});

// Inisialisasi saat DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
    const isUserVerified = await verifyUserAndLoadEmployee();
    if (!isUserVerified) {
        // Jika verifikasi gagal, tombol submit dinonaktifkan
        submitButton.disabled = true;
        submitButton.textContent = 'Gagal Memuat Data';
    }
});
