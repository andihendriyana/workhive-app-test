const SUPABASE_URL = 'https://nvtedibubuiykovrtfiv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dGVkaWJ1YnVpeWtvdnJ0Zml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTk5MzQsImV4cCI6MjA2Nzc3NTkzNH0.s5-CtQuXYAf1hQcRwljYhROibzm9U65XGxtD7LJeNVU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// Fungsi untuk memformat tanggal
function formatDate(isoString) {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric'
    });
}

// Fungsi untuk membuat badge status
function createStatusBadge(status) {
    let bgColor, textColor;
    switch (status) {
        case 'Approved':
            bgColor = 'bg-green-100';
            textColor = 'text-green-800';
            break;
        case 'Rejected':
            bgColor = 'bg-red-100';
            textColor = 'text-red-800';
            break;
        default: // Pending
            bgColor = 'bg-yellow-100';
            textColor = 'text-yellow-800';
            break;
    }
    return `<span class="px-2 py-1 font-semibold leading-tight rounded-full ${bgColor} ${textColor}">${status}</span>`;
}

// Fungsi utama untuk mengambil riwayat cuti
async function getLeaveHistory(employeeId) {
    const tbody = document.getElementById('leave-history-tbody');
    if (!tbody) return;

    // Ambil data dari 'leave_requests' HANYA untuk employee_id yang sedang login
    const { data, error } = await supabaseClient
        .from('leave_requests')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-red-500">Gagal memuat riwayat.</td></tr>`;
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-gray-500">Anda belum pernah mengajukan cuti.</td></tr>`;
        return;
    }

    tbody.innerHTML = ''; // Kosongkan tabel
    data.forEach(request => {
        const row = `
            <tr class="bg-white border-b">
                <td class="px-6 py-4">${formatDate(request.created_at)}</td>
                <td class="px-6 py-4">${formatDate(request.start_date)}</td>
                <td class="px-6 py-4">${formatDate(request.end_date)}</td>
                <td class="px-6 py-4">${request.reason}</td>
                <td class="px-6 py-4">${createStatusBadge(request.status)}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// Cek sesi login untuk mendapatkan ID karyawan
async function checkUserSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    
    const { data: employeeData } = await supabaseClient
        .from('employees')
        .select('id')
        .eq('email', session.user.email)
        .single();
    
    if (employeeData) {
        getLeaveHistory(employeeData.id); // Panggil fungsi dengan ID karyawan
    }
}

document.addEventListener('DOMContentLoaded', checkUserSession);