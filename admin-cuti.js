// admin-cuti.js

// Konfigurasi Supabase Anda
// PENTING: Pastikan ini adalah URL dan Public Key Supabase Anda yang sebenarnya
const SUPABASE_URL = 'https://nvtedibubuiykovrtfiv.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dGVkaWJ1YnVpeWtvdnJ0Zml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTk5MzQsImV4cCI6MjA2Nzc3NTkzNH0.s5-CtQuXYAf1hQcRwljYhROibzm9U65XGxtD7LJeNVU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Mendapatkan referensi elemen DOM
const approvalTbody = document.getElementById('approval-tbody');

let currentManager = null; // Untuk menyimpan data manajer yang sedang login

// Fungsi untuk menampilkan pesan status (opsional, bisa diintegrasikan jika ada div status)
function showMessage(message, isError = false) {
    console.log(`[Status] ${isError ? 'ERROR: ' : ''}${message}`);
    // Anda bisa menambahkan div HTML untuk menampilkan pesan ini di UI jika diinginkan
}

// Fungsi untuk memverifikasi manajer dan memuat pengajuan cuti
async function loadPendingLeaveRequests() {
    console.log("Loading pending leave requests..."); // Debugging
    approvalTbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Memuat data...</td></tr>`;

    try {
        // 1. Verifikasi sesi pengguna dan dapatkan data manajer
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

        // Ambil data manajer berdasarkan email yang login
        const { data: managerDataArray, error: managerError } = await supabaseClient
            .from('employees')
            .select('id, nama_lengkap, role') // Ambil ID dan role
            .eq('email', session.user.email)
            .limit(1); // Menggunakan limit(1)

        const managerData = managerDataArray && managerDataArray.length > 0 ? managerDataArray[0] : null;

        console.log("Manager Data:", managerData); // Debugging
        console.log("Manager Error:", managerError); // Debugging

        if (managerError || !managerData || managerData.role.toLowerCase() !== 'manager') {
            console.error("User is not a manager or data not found.");
            showMessage("Anda tidak memiliki izin untuk mengakses halaman ini.", true);
            approvalTbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">Anda tidak memiliki izin untuk mengakses halaman ini.</td></tr>`;
            return;
        }

        currentManager = managerData;
        
        // 2. Ambil ID karyawan yang melapor ke manajer ini
        // Asumsi: karyawan memiliki kolom 'manager_id' yang merujuk ke ID manajer mereka
        const { data: subordinates, error: subordinatesError } = await supabaseClient
            .from('employees')
            .select('id, nama_lengkap')
            .eq('manager_id', currentManager.id); // Filter bawahan berdasarkan ID manajer

        console.log("Subordinates Data:", subordinates); // Debugging
        console.log("Subordinates Error:", subordinatesError); // Debugging

        if (subordinatesError) {
            throw subordinatesError;
        }
        if (!subordinates || subordinates.length === 0) {
            approvalTbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Tidak ada bawahan yang terdaftar untuk Anda.</td></tr>`;
            return;
        }
        const subordinateIds = subordinates.map(s => s.id);
        console.log("Subordinate IDs:", subordinateIds); // Debugging

        // 3. Ambil pengajuan cuti dari bawahan ini
        // Menambahkan { reload: true } untuk memaksa pengambilan data terbaru dari DB
        const { data: leaveRequests, error: leaveRequestsError } = await supabaseClient
            .from('leave_requests')
            .select('id, employee_id, start_date, end_date, reason, status, employees!leave_requests_employee_id_fkey(nama_lengkap)', { reload: true }) // <--- TAMBAHKAN { reload: true } DI SINI
            .in('employee_id', subordinateIds) // Filter berdasarkan ID bawahan
            // .eq('status', 'Pending') // Baris ini DIKOMENTARI untuk mengambil semua status
            .order('created_at', { ascending: true });

        console.log("All Leave Requests Data (from subordinates, after update):", leaveRequests); // Debugging
        console.log("All Leave Requests Error (from subordinates, after update):", leaveRequestsError); // Debugging

        if (leaveRequestsError) {
            throw leaveRequestsError;
        }
        if (!leaveRequests || leaveRequests.length === 0) {
            approvalTbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Tidak ada pengajuan cuti dari tim Anda.</td></tr>`;
            return;
        }

        // 4. Tampilkan di tabel
        approvalTbody.innerHTML = ''; // Bersihkan tabel
        leaveRequests.forEach(request => {
            const row = document.createElement('tr');
            row.classList.add('bg-white', 'border-b', 'hover:bg-gray-50');
            
            // Tentukan warna badge status
            let statusBadgeClass = '';
            if (request.status === 'Pending') {
                statusBadgeClass = 'bg-yellow-100 text-yellow-800';
            } else if (request.status === 'Approved') {
                statusBadgeClass = 'bg-green-100 text-green-800';
            } else if (request.status === 'Rejected') {
                statusBadgeClass = 'bg-red-100 text-red-800';
            }

            row.innerHTML = `
                <td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">${request.employees.nama_lengkap}</td>
                <td class="px-6 py-4">${request.start_date} s/d ${request.end_date}</td>
                <td class="px-6 py-4">${request.reason}</td>
                <td class="px-6 py-4"><span class="px-2 py-1 font-semibold leading-tight rounded-full ${statusBadgeClass}">${request.status}</span></td>
                <td class="px-6 py-4 space-x-2">
                    ${request.status === 'Pending' ? `
                        <button class="approve-btn bg-green-500 hover:bg-green-600 text-white font-semibold py-1 px-3 rounded-lg text-xs" data-id="${request.id}">Setujui</button>
                        <button class="reject-btn bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-lg text-xs" data-id="${request.id}">Tolak</button>
                    ` : `
                        <span class="text-gray-500 text-xs">Sudah di${request.status.toLowerCase()}</span>
                    `}
                </td>
            `;
            approvalTbody.appendChild(row);
        });

        // 5. Tambahkan event listener untuk tombol aksi
        document.querySelectorAll('.approve-btn').forEach(button => {
            button.addEventListener('click', () => updateLeaveRequestStatus(button.dataset.id, 'Approved'));
        });
        document.querySelectorAll('.reject-btn').forEach(button => {
            button.addEventListener('click', () => updateLeaveRequestStatus(button.dataset.id, 'Rejected'));
        });

    } catch (e) {
        console.error("Caught error in loadPendingLeaveRequests:", e);
        showMessage(`Terjadi kesalahan saat memuat pengajuan cuti: ${e.message}`, true);
        approvalTbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">Gagal memuat pengajuan cuti: ${e.message}</td></tr>`;
    }
}

// Fungsi untuk memperbarui status pengajuan cuti
async function updateLeaveRequestStatus(requestId, newStatus) {
    console.log(`Updating leave request ${requestId} to status: ${newStatus}`); // Debugging
    try {
        const { error } = await supabaseClient
            .from('leave_requests')
            .update({ status: newStatus, approved_by: currentManager.id }) // Tambahkan approved_by
            .eq('id', requestId);

        if (error) {
            throw error;
        }
        showMessage(`Pengajuan cuti berhasil di${newStatus.toLowerCase()}!`);
        
        // Tambahkan console.log untuk memastikan reload dipicu
        console.log("Attempting to reload page to refresh data (after 1 second delay)..."); // Debugging
        setTimeout(() => {
            location.reload(); // <--- BARIS INI UNTUK MEMAKSA REFRESH HALAMAN
        }, 1000); // Tambahkan penundaan 1 detik

    } catch (e) {
        console.error("Error updating leave request status:", e);
        showMessage(`Gagal ${newStatus.toLowerCase()} pengajuan cuti: ${e.message}`, true);
    }
}

// Inisialisasi saat DOMContentLoaded
document.addEventListener('DOMContentLoaded', loadPendingLeaveRequests);
