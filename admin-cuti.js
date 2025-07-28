// admin-cuti.js

// Konfigurasi Supabase Anda
const SUPABASE_URL = 'https://nvtedibubuiykovrtfiv.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dGVkaWJ1YnVpeWtvdnJ0Zml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTk5MzQsImV4cCI6MjA2Nzc3NTkzNH0.s5-CtQuXYAf1hQcRwljYhROibzm9U65XGxtD7LJeNVU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Mendapatkan referensi elemen DOM
const approvalTbody = document.getElementById('approval-tbody');

let currentManager = null; // Untuk menyimpan data manajer yang sedang login
let leaveRequestsSubscription = null; // Untuk menyimpan objek langganan realtime

// Fungsi untuk menampilkan pesan status (opsional, bisa diintegrasikan jika ada div status)
function showMessage(message, isError = false) {
    console.log(`[Status] ${isError ? 'ERROR: ' : ''}${message}`);
    // Anda bisa menambahkan div HTML untuk menampilkan pesan ini di UI jika diinginkan
}

// Fungsi untuk memverifikasi manajer dan memuat pengajuan cuti
async function loadPendingLeaveRequests() {
    console.log("loadPendingLeaveRequests - Loading pending leave requests..."); // Debugging
    approvalTbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Memuat data...</td></tr>`;

    try {
        // 1. Verifikasi sesi pengguna dan dapatkan data manajer
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError) {
            console.error("loadPendingLeaveRequests - Error getting session:", sessionError);
            showMessage("Gagal memverifikasi sesi. Mohon login ulang.", true);
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            return;
        }
        if (!session) {
            console.log("loadPendingLeaveRequests - No session found, redirecting to login.");
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

        console.log("loadPendingLeaveRequests - Manager Data:", managerData); // Debugging
        console.log("loadPendingLeaveRequests - Manager Error:", managerError); // Debugging

        if (managerError || !managerData || managerData.role.toLowerCase() !== 'manager') {
            console.error("loadPendingLeaveRequests - User is not a manager or data not found.");
            showMessage("Anda tidak memiliki izin untuk mengakses halaman ini.", true);
            approvalTbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">Anda tidak memiliki izin untuk mengakses halaman ini.</td></tr>`;
            return;
        }

        currentManager = managerData;
        
        // 2. Ambil ID karyawan yang melapor ke manajer ini
        const { data: subordinates, error: subordinatesError } = await supabaseClient
            .from('employees')
            .select('id, nama_lengkap')
            .eq('manager_id', currentManager.id); // Filter bawahan berdasarkan ID manajer

        console.log("loadPendingLeaveRequests - Subordinates Data:", subordinates); // Debugging
        console.log("Subordinates Error:", subordinatesError); // Debugging

        if (subordinatesError) {
            throw subordinatesError;
        }
        if (!subordinates || subordinates.length === 0) {
            approvalTbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Tidak ada bawahan yang terdaftar untuk Anda.</td></tr>`;
            return;
        }
        const subordinateIds = subordinates.map(s => s.id);
        console.log("loadPendingLeaveRequests - Subordinate IDs:", subordinateIds); // Debugging

        // 3. Ambil pengajuan cuti awal
        const { data: leaveRequests, error: leaveRequestsError } = await supabaseClient
            .from('leave_requests')
            .select('id, employee_id, start_date, end_date, reason, status, employees!leave_requests_employee_id_fkey(nama_lengkap)')
            // .in('employee_id', subordinateIds) // Filter berdasarkan ID bawahan - HAPUS FILTER INI DARI SINI
            // .eq('status', 'Pending') // Baris ini DIKOMENTARI untuk mengambil semua status
            .order('created_at', { ascending: true });

        console.log("loadPendingLeaveRequests - Initial Leave Requests Data:", leaveRequests); // Debugging
        console.log("loadPendingLeaveRequests - Initial Leave Requests Error:", leaveRequestsError); // Debugging

        if (leaveRequestsError) {
            throw leaveRequestsError;
        }
        
        // Tampilkan data awal (dengan filter klien)
        const filteredInitialRequests = leaveRequests.filter(req => subordinateIds.includes(req.employee_id));
        displayLeaveRequests(filteredInitialRequests);

        // 4. Setup Realtime Listener (tanpa filter Realtime di sini)
        // Hentikan langganan sebelumnya jika ada untuk menghindari duplikasi listener
        if (leaveRequestsSubscription) {
            leaveRequestsSubscription.unsubscribe();
        }

        leaveRequestsSubscription = supabaseClient
            .channel('public:leave_requests') // Nama channel
            .on('postgres_changes', { 
                event: '*', // Dengarkan semua event (INSERT, UPDATE, DELETE)
                schema: 'public',
                table: 'leave_requests'
                // Filter di sini dihapus
            }, (payload) => {
                console.log('Realtime change received!', payload); // Debugging realtime
                console.log('Payload new data:', payload.new); // Debugging: Data baru setelah perubahan
                console.log('Payload old data:', payload.old); // Debugging: Data lama sebelum perubahan
                // Saat ada perubahan, muat ulang data dari database
                loadAndDisplayLeaveRequestsFromDB(subordinateIds); // Panggil dengan subordinateIds untuk filter klien
            })
            .subscribe();

    } catch (e) {
        console.error("loadPendingLeaveRequests - Caught error:", e);
        showMessage(`Terjadi kesalahan saat memuat pengajuan cuti: ${e.message}`, true);
        approvalTbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">Gagal memuat pengajuan cuti: ${e.message}</td></tr>`;
    }
}

// Fungsi terpisah untuk mengambil dan menampilkan data dari DB (dipanggil oleh realtime listener)
async function loadAndDisplayLeaveRequestsFromDB(subordinateIds) {
    console.log("loadAndDisplayLeaveRequestsFromDB - Realtime triggered: Reloading leave requests from DB..."); // Debugging
    try {
        const { data: leaveRequests, error: leaveRequestsError } = await supabaseClient
            .from('leave_requests')
            .select('id, employee_id, start_date, end_date, reason, status, employees!leave_requests_employee_id_fkey(nama_lengkap)', { reload: true }) // Force reload
            .order('created_at', { ascending: true });

        if (leaveRequestsError) {
            throw leaveRequestsError;
        }

        // Filter data di sisi klien setelah diambil
        const filteredLeaveRequests = leaveRequests.filter(req => subordinateIds.includes(req.employee_id));
        
        displayLeaveRequests(filteredLeaveRequests); // Panggil fungsi tampilan
    } catch (e) {
        console.error("loadAndDisplayLeaveRequestsFromDB - Error reloading leave requests via realtime:", e);
        showMessage(`Gagal memperbarui daftar cuti secara realtime: ${e.message}`, true);
    }
}


// Fungsi untuk menampilkan pengajuan cuti di tabel (terpisah dari pengambilan data)
function displayLeaveRequests(leaveRequests) {
    if (!leaveRequests || leaveRequests.length === 0) {
        approvalTbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Tidak ada pengajuan cuti dari tim Anda.</td></tr>`;
        return;
    }

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

    // Tambahkan event listener untuk tombol aksi setelah tabel di-render
    document.querySelectorAll('.approve-btn').forEach(button => {
        button.addEventListener('click', () => updateLeaveRequestStatus(button.dataset.id, 'Approved'));
    });
    document.querySelectorAll('.reject-btn').forEach(button => {
        button.addEventListener('click', () => updateLeaveRequestStatus(button.dataset.id, 'Rejected'));
    });
}

// Fungsi untuk memperbarui status pengajuan cuti
async function updateLeaveRequestStatus(requestId, newStatus) {
    console.log(`Updating leave request ${requestId} to status: ${newStatus}`); // Debugging
    try {
        // Ambil detail pengajuan cuti untuk mendapatkan employee_id dan durasi
        const { data: leaveRequestDetail, error: detailError } = await supabaseClient
            .from('leave_requests')
            .select('employee_id, start_date, end_date')
            .eq('id', requestId)
            .single();

        if (detailError) {
            throw detailError;
        }
        if (!leaveRequestDetail) {
            showMessage("Detail pengajuan cuti tidak ditemukan.", true);
            return;
        }

        // Hitung durasi cuti dalam hari
        const startDate = new Date(leaveRequestDetail.start_date);
        const endDate = new Date(leaveRequestDetail.end_date);
        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 karena inklusif hari mulai dan selesai
        console.log(`Leave duration for ${requestId}: ${diffDays} days`); // Debugging

        // Lakukan UPDATE status pengajuan cuti
        const { error: updateRequestError } = await supabaseClient
            .from('leave_requests')
            .update({ status: newStatus, approved_by: currentManager.id })
            .eq('id', requestId);

        if (updateRequestError) {
            throw updateRequestError;
        }

        // Jika status BARU adalah 'Approved', kurangi saldo cuti karyawan
        if (newStatus === 'Approved') {
            // Ambil saldo cuti karyawan saat ini
            const { data: employeeData, error: fetchEmployeeError } = await supabaseClient
                .from('employees')
                .select('leave_balance')
                .eq('id', leaveRequestDetail.employee_id)
                .single();

            if (fetchEmployeeError) {
                throw fetchEmployeeError;
            }
            if (!employeeData) {
                showMessage("Data karyawan tidak ditemukan untuk mengurangi saldo cuti.", true);
                return;
            }

            const currentBalance = parseFloat(employeeData.leave_balance);
            const newBalance = currentBalance - diffDays;
            console.log(`Employee ${leaveRequestDetail.employee_id} balance: ${currentBalance} - ${diffDays} = ${newBalance}`); // Debugging

            // Lakukan UPDATE saldo cuti karyawan
            const { error: updateBalanceError } = await supabaseClient
                .from('employees')
                .update({ leave_balance: newBalance })
                .eq('id', leaveRequestDetail.employee_id);

            if (updateBalanceError) {
                throw updateBalanceError;
            }
            console.log("Leave balance updated successfully."); // Debugging
        }

        showMessage(`Pengajuan cuti berhasil di${newStatus.toLowerCase()}!`);
        console.log("Update successful, expecting realtime update."); // Debugging

    } catch (e) {
        console.error("Error updating leave request status:", e);
        showMessage(`Gagal ${newStatus.toLowerCase()} pengajuan cuti: ${e.message}`, true);
    }
}

// Inisialisasi saat DOMContentLoaded
document.addEventListener('DOMContentLoaded', loadPendingLeaveRequests);

// Pastikan untuk menghentikan langganan realtime saat halaman ditutup/dinavigasi
window.addEventListener('beforeunload', () => {
    if (leaveRequestsSubscription) {
        leaveRequestsSubscription.unsubscribe();
        console.log("Realtime subscription unsubscribed.");
    }
});
