const SUPABASE_URL = 'https://nvtedibubuiykovrtfiv.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dGVkaWJ1YnVpeWtvdnJ0Zml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTk5MzQsImV4cCI6MjA2Nzc3NTkzNH0.s5-CtQuXYAf1hQcRwljYhROibzm9U65XGxtD7LJeNVU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Mendapatkan referensi elemen DOM
const attendanceHistoryTbody = document.getElementById('attendance-history-tbody');
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

// Fungsi untuk membuat badge status absensi
function createAttendanceStatusBadge(status) {
    let bgColor, textColor;
    if (status === 'Terlambat') {
        bgColor = 'bg-red-100';
        textColor = 'text-red-800';
    } else if (status === 'Hadir') {
        bgColor = 'bg-green-100';
        textColor = 'text-green-800';
    } else { // Izin, Sakit, Cuti, Alpha
        bgColor = 'bg-yellow-100';
        textColor = 'text-yellow-800';
    }
    return `<span class="status-badge ${bgColor} ${textColor}">${status}</span>`;
}

// Fungsi untuk format waktu (HH:MM)
function formatTime(isoString) {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

// Fungsi untuk menghitung durasi kerja dalam jam
function calculateDurationHours(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 'N/A';
    const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return (diffMs / (1000 * 60 * 60)).toFixed(2); // dalam jam, 2 desimal
}

// Fungsi untuk memverifikasi pengguna dan memuat riwayat absensi
async function loadAttendanceHistory() {
    console.log("Loading attendance history..."); // Debugging
    attendanceHistoryTbody.innerHTML = `<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">Memuat riwayat absensi...</td></tr>`;

    try {
        // 1. Verifikasi sesi pengguna dan dapatkan data karyawan
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError) {
            console.error("Error getting session:", sessionError);
            showMessage("Gagal memverifikasi sesi. Mohon login ulang.", true);
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            return;
        }
        if (!session) {
            console.log("No session found, redirecting to login.");
            showMessage("Anda belum login. Mengarahkan ke halaman login...", true);
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            return;
        }

        // Ambil data karyawan berdasarkan email yang login
        const { data: employeeDataArray, error: employeeError } = await supabaseClient
            .from('employees')
            .select('id, nama_lengkap') // Hanya ambil ID dan nama untuk verifikasi
            .eq('email', session.user.email)
            .limit(1);

        const employeeData = employeeDataArray && employeeDataArray.length > 0 ? employeeDataArray[0] : null;

        if (employeeError || !employeeData) {
            console.error("Employee data not found for current session:", employeeError);
            showMessage("Profil karyawan tidak ditemukan. Mohon refresh halaman atau hubungi admin.", true);
            attendanceHistoryTbody.innerHTML = `<tr><td colspan="7" class="px-6 py-4 text-center text-red-500">Profil tidak ditemukan.</td></tr>`;
            return;
        }

        currentEmployee = employeeData;
        console.log("Current employee for attendance history:", currentEmployee); // Debugging

        // 2. Ambil riwayat absensi karyawan ini
        const { data: attendanceRecords, error: attendanceRecordsError } = await supabaseClient
            .from('attendances')
            .select('*') // Ambil semua kolom absensi
            .eq('employee_id', currentEmployee.id) // Filter hanya untuk karyawan ini
            .order('tanggal', { ascending: false }, { reload: true }); // Urutkan dari tanggal terbaru, force reload

        console.log("Attendance Records History Data:", attendanceRecords); // Debugging
        console.log("Attendance Records History Error:", attendanceRecordsError); // Debugging

        if (attendanceRecordsError) {
            throw attendanceRecordsError;
        }
        if (!attendanceRecords || attendanceRecords.length === 0) {
            attendanceHistoryTbody.innerHTML = `<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">Anda belum memiliki riwayat absensi.</td></tr>`;
            return;
        }

        // 3. Tampilkan di tabel
        attendanceHistoryTbody.innerHTML = ''; // Bersihkan tabel
        attendanceRecords.forEach(record => {
            const row = document.createElement('tr');
            row.classList.add('bg-white', 'border-b', 'hover:bg-gray-50');
            
            let clockInTimeClass = '';
            if (record.status_kehadiran === 'Terlambat') {
                clockInTimeClass = 'time-status-late';
            } else if (record.status_kehadiran === 'Hadir') {
                clockInTimeClass = 'time-status-on-time';
            }

            row.innerHTML = `
                <td class="px-6 py-4">${record.tanggal}</td>
                <td class="px-6 py-4 ${clockInTimeClass}">${formatTime(record.check_in)}</td>
                <td class="px-6 py-4">${formatTime(record.check_out)}</td>
                <td class="px-6 py-4">${calculateDurationHours(record.check_in, record.check_out)}</td>
                <td class="px-6 py-4">${createAttendanceStatusBadge(record.status_kehadiran)}</td>
                <td class="px-6 py-4">${record.catatan || 'Tidak ada'}</td>
                <td class="px-6 py-4">
                    ${record.selfie_url ? `<a href="${record.selfie_url}" target="_blank" class="text-blue-600 hover:underline">Lihat Selfie</a>` : 'Tidak ada'}
                </td>
            `;
            attendanceHistoryTbody.appendChild(row);
        });

    } catch (e) {
        console.error("Caught error in loadAttendanceHistory:", e);
        showMessage(`Terjadi kesalahan saat memuat riwayat absensi: ${e.message}`, true);
        attendanceHistoryTbody.innerHTML = `<tr><td colspan="7" class="px-6 py-4 text-center text-red-500">Gagal memuat riwayat absensi: ${e.message}</td></tr>`;
    }
}

// Inisialisasi saat DOMContentLoaded
document.addEventListener('DOMContentLoaded', loadAttendanceHistory);
