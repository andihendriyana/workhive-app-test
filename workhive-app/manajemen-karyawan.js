// manajemen-karyawan.js

// Konfigurasi Supabase Anda
const SUPABASE_URL = 'https://nvtedibubuiykovrtfiv.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dGVkaWJ1YnVpeWtvdnJ0Zml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTk5MzQsImV4cCI6MjA2Nzc3NTkzNH0.s5-CtQuXYAf1hQcRwljYhROibzm9U65XGxtD7LJeNVU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Mendapatkan referensi elemen DOM
const statusMessageDiv = document.getElementById('status-message');
const employeeForm = document.getElementById('employee-form');
const employeeIdInput = document.getElementById('employee-id');
const namaLengkapInput = document.getElementById('nama-lengkap');
const emailInput = document.getElementById('email');
const nikInput = document.getElementById('nik');
const npwpInput = document.getElementById('npwp');
const tanggalMasukInput = document.getElementById('tanggal-masuk');
const statusKaryawanSelect = document.getElementById('status-karyawan');
const jabatanInput = document.getElementById('jabatan');
const roleSelect = document.getElementById('role');
const gajiPokokInput = document.getElementById('gaji-pokok');
const tunjanganTetapInput = document.getElementById('tunjangan-tetap');
const statusPajakSelect = document.getElementById('status-pajak');
const jumlahTanggunganInput = document.getElementById('jumlah-tanggungan');
const nomorBpjsKesehatanInput = document.getElementById('nomor-bpjs-kesehatan');
const nomorBpjsKetenagakerjaanInput = document.getElementById('nomor-bpjs-ketenagakerjaan');
const nomorRekeningInput = document.getElementById('nomor-rekening');
const namaBankInput = document.getElementById('nama-bank');
const departmentIdSelect = document.getElementById('department-id');
const managerIdSelect = document.getElementById('manager-id');
const avatarUrlInput = document.getElementById('avatar-url');
const avatarPreview = document.getElementById('avatar-preview');

const formTitle = document.getElementById('form-title');
const saveButton = employeeForm.querySelector('button[type="submit"]');
const cancelEditButton = document.getElementById('cancel-edit-btn');
const employeeTbody = document.getElementById('employee-tbody');

let currentManagerUser = null; // Untuk menyimpan data manajer yang sedang login

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

// Fungsi untuk memverifikasi manajer
async function verifyManagerAccess() {
    console.log("Verifying manager access for employee management..."); // Debugging
    try {
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError) {
            console.error("VerifyManagerAccess - Error getting session:", sessionError);
            showMessage("Gagal memverifikasi sesi. Mohon login ulang.", true);
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            return false;
        }
        if (!session) {
            console.log("VerifyManagerAccess - No session found, redirecting to login.");
            showMessage("Anda belum login. Mengarahkan ke halaman login...", true);
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            return false;
        }

        const { data: managerDataArray, error: managerError } = await supabaseClient
            .from('employees')
            .select('id, role')
            .eq('email', session.user.email)
            .limit(1);

        const managerData = managerDataArray && managerDataArray.length > 0 ? managerDataArray[0] : null;

        if (managerError || !managerData || managerData.role.toLowerCase() !== 'manager') {
            console.error("VerifyManagerAccess - User is not a manager or data not found.");
            showMessage("Anda tidak memiliki izin untuk mengakses halaman ini.", true);
            document.body.innerHTML = `<div class="flex items-center justify-center h-screen text-red-500 text-xl">Anda tidak memiliki izin untuk mengakses halaman ini.</div>`;
            return false;
        }

        currentManagerUser = managerData;
        console.log("VerifyManagerAccess - Manager successfully verified:", currentManagerUser); // Debugging
        return true;

    } catch (e) {
        console.error("VerifyManagerAccess - Caught error in verifyManagerAccess:", e);
        showMessage(`Terjadi kesalahan saat memverifikasi akses: ${e.message}`, true);
        document.body.innerHTML = `<div class="flex items-center justify-center h-screen text-red-500 text-xl">Terjadi kesalahan saat memuat halaman.</div>`;
        return false;
    }
}

// Fungsi untuk memuat dropdown departemen
async function loadDepartments() {
async function loadDepartments() {
        console.log("Loading departments for dropdown..."); // Debugging
        try {
            const { data: departments, error } = await supabaseClient
                .from('departments') // Pastikan tabel 'departments' ada
                .select('id, name') // <--- UBAH INI: Ganti 'nama_departemen' dengan nama kolom yang benar (misal 'name')
                .order('name', { ascending: true }); // <--- UBAH INI JUGA: Order berdasarkan nama kolom yang benar

            if (error) throw error;

            departmentIdSelect.innerHTML = '<option value="">Pilih Departemen</option>';
            if (departments && departments.length > 0) {
                departments.forEach(dept => {
                    const option = document.createElement('option');
                    option.value = dept.id;
                    option.textContent = dept.name; // <--- UBAH INI: Gunakan nama kolom yang benar (misal 'name')
                    departmentIdSelect.appendChild(option);
                });
            } else {
                departmentIdSelect.innerHTML = '<option value="">Tidak ada departemen</option>';
            }
            console.log("Departments loaded:", departments); // Debugging
        } catch (e) {
            console.error("Error loading departments:", e);
            showMessage(`Gagal memuat daftar departemen: ${e.message}`, true);
        }
    }   

// Fungsi untuk memuat dropdown manajer (karyawan lain dengan role manager)
async function loadManagers() {
    console.log("Loading managers for dropdown..."); // Debugging
    try {
        const { data: managers, error } = await supabaseClient
            .from('employees')
            .select('id, nama_lengkap')
            .eq('role', 'manager') // Hanya ambil yang role-nya manager
            .order('nama_lengkap', { ascending: true });

        if (error) throw error;

        managerIdSelect.innerHTML = '<option value="">Tidak Ada / Pilih Manajer</option>';
        if (managers && managers.length > 0) {
            managers.forEach(mgr => {
                // Hindari manajer memilih dirinya sendiri sebagai manajer (opsional)
                if (currentManagerUser && mgr.id === currentManagerUser.id) return; 
                const option = document.createElement('option');
                option.value = mgr.id;
                option.textContent = mgr.nama_lengkap;
                managerIdSelect.appendChild(option);
            });
        }
        console.log("Managers loaded:", managers); // Debugging
    } catch (e) {
        console.error("Error loading managers:", e);
        showMessage(`Gagal memuat daftar manajer: ${e.message}`, true);
    }
}

// Fungsi untuk memuat daftar karyawan
async function loadEmployeeList() {
    console.log("Loading employee list..."); // Debugging
    employeeTbody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">Memuat karyawan...</td></tr>`;

    try {
        const { data: employees, error } = await supabaseClient
            .from('employees')
            .select('id, nama_lengkap, email, jabatan, role, department_id, departments(nama_departemen), manager_id, employees_manager_id_fkey(nama_lengkap)') // Join dengan departemen dan manajer
            .order('nama_lengkap', { ascending: true });

        console.log("Employee List Data:", employees); // Debugging
        console.log("Employee List Error:", error); // Debugging

        if (error) {
            throw error;
        }
        if (!employees || employees.length === 0) {
            employeeTbody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">Tidak ada karyawan terdaftar.</td></tr>`;
            return;
        }

        employeeTbody.innerHTML = ''; // Bersihkan tabel
        employees.forEach(emp => {
            const row = document.createElement('tr');
            row.classList.add('bg-white', 'border-b', 'hover:bg-gray-50');
            
            const departmentName = emp.departments ? emp.departments.nama_departemen : 'N/A';
            const managerName = emp.employees_manager_id_fkey ? emp.employees_manager_id_fkey.nama_lengkap : 'N/A';

            row.innerHTML = `
                <td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">${emp.nama_lengkap}</td>
                <td class="px-6 py-4">${emp.email}</td>
                <td class="px-6 py-4">${emp.jabatan || 'N/A'}</td>
                <td class="px-6 py-4">${emp.role || 'N/A'}</td>
                <td class="px-6 py-4">${departmentName}</td>
                <td class="px-6 py-4 space-x-2">
                    <button class="edit-btn bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-1 px-3 rounded-lg text-xs" data-id="${emp.id}">Edit</button>
                    <button class="delete-btn bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-lg text-xs" data-id="${emp.id}">Hapus</button>
                </td>
            `;
            employeeTbody.appendChild(row);
        });

        // Tambahkan event listener untuk tombol aksi
        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', () => editEmployee(button.dataset.id));
        });
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', () => deleteEmployee(button.dataset.id));
        });

    } catch (e) {
        console.error("Caught error loading employee list:", e);
        employeeTbody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Gagal memuat daftar karyawan: ${e.message}</td></tr>`;
    }
}

// Event listener untuk form tambah/edit karyawan
employeeForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Mencegah refresh halaman

    if (!currentManagerUser) {
        showMessage("Akses ditolak. Mohon refresh halaman.", true);
        return;
    }

    const employeeId = employeeIdInput.value; // ID jika sedang edit
    const namaLengkap = namaLengkapInput.value.trim();
    const email = emailInput.value.trim();
    const nik = nikInput.value.trim();
    const npwp = npwpInput.value.trim();
    const tanggalMasuk = tanggalMasukInput.value;
    const statusKaryawan = statusKaryawanSelect.value;
    const jabatan = jabatanInput.value.trim();
    const role = roleSelect.value;
    const gajiPokok = parseFloat(gajiPokokInput.value);
    const tunjanganTetap = parseFloat(tunjanganTetapInput.value);
    const statusPajak = statusPajakSelect.value;
    const jumlahTanggungan = parseInt(jumlahTanggunganInput.value);
    const nomorBpjsKesehatan = nomorBpjsKesehatanInput.value.trim();
    const nomorBpjsKetenagakerjaan = nomorBpjsKetenagakerjaanInput.value.trim();
    const nomorRekening = nomorRekeningInput.value.trim();
    const namaBank = namaBankInput.value.trim();
    const departmentId = departmentIdSelect.value || null;
    const managerId = managerIdSelect.value || null;
    const avatarUrl = avatarUrlInput.value.trim();

    // Validasi dasar
    if (!namaLengkap || !email || !tanggalMasuk || !gajiPokok || !statusPajak || !role || !jabatan || !statusKaryawan) {
        showMessage("Harap isi semua kolom wajib (Nama, Email, Tgl Masuk, Gaji Pokok, Status Pajak, Role, Jabatan, Status Karyawan).", true);
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = 'Menyimpan...';
    showMessage('Menyimpan data karyawan...', false);
    console.log("Submitting employee data:", { namaLengkap, email, employeeId }); // Debugging

    const employeeData = {
        nama_lengkap: namaLengkap,
        email: email,
        nik: nik || null,
        npwp: npwp || null,
        tanggal_masuk: tanggalMasuk,
        status_karyawan: statusKaryawan,
        jabatan: jabatan,
        role: role,
        gaji_pokok: gajiPokok,
        tunjangan_tetap: tunjanganTetap || 0,
        status_pajak: statusPajak,
        jumlah_tanggungan: jumlahTanggungan,
        nomor_bpjs_kesehatan: nomorBpjsKesehatan || null,
        nomor_bpjs_ketenagakerjaan: nomorBpjsKetenagakerjaan || null,
        nomor_rekening: nomorRekening || null,
        nama_bank: namaBank || null,
        department_id: departmentId,
        manager_id: managerId,
        avatar_url: avatarUrl || null
    };

    try {
        let error;
        if (employeeId) { // Mode Edit
            console.log("Updating existing employee:", employeeId, employeeData); // Debugging
            ({ error } = await supabaseClient.from('employees').update(employeeData).eq('id', employeeId));
        } else { // Mode Tambah Baru
            console.log("Inserting new employee:", employeeData); // Debugging
            ({ error } = await supabaseClient.from('employees').insert(employeeData));
        }

        if (error) {
            throw error;
        }

        showMessage("Data karyawan berhasil disimpan!", false);
        console.log("Employee data saved successfully."); // Debugging
        employeeForm.reset(); // Reset form
        employeeIdInput.value = ''; // Reset ID
        formTitle.textContent = 'Tambah Karyawan Baru';
        cancelEditButton.classList.add('hidden');
        saveButton.innerHTML = '<i class="fas fa-save mr-2"></i> Simpan Karyawan';
        loadEmployeeList(); // Muat ulang daftar
    } catch (e) {
        console.error("Error saving employee data:", e); // Debugging
        showMessage(`Gagal menyimpan data karyawan: ${e.message}`, true);
    } finally {
        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="fas fa-save mr-2"></i> Simpan Karyawan';
    }
});

// Fungsi untuk mengisi form saat mode edit
async function editEmployee(id) {
    console.log("Editing employee with ID:", id); // Debugging
    try {
        const { data: employeeToEdit, error } = await supabaseClient
            .from('employees')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            throw error;
        }
        if (!employeeToEdit) {
            showMessage("Karyawan tidak ditemukan.", true);
            return;
        }

        employeeIdInput.value = employeeToEdit.id;
        namaLengkapInput.value = employeeToEdit.nama_lengkap;
        emailInput.value = employeeToEdit.email;
        nikInput.value = employeeToEdit.nik || '';
        npwpInput.value = employeeToEdit.npwp || '';
        tanggalMasukInput.value = employeeToEdit.tanggal_masuk;
        statusKaryawanSelect.value = employeeToEdit.status_karyawan;
        jabatanInput.value = employeeToEdit.jabatan || '';
        roleSelect.value = employeeToEdit.role;
        gajiPokokInput.value = employeeToEdit.gaji_pokok;
        tunjanganTetapInput.value = employeeToEdit.tunjangan_tetap || 0;
        statusPajakSelect.value = employeeToEdit.status_pajak;
        jumlahTanggunganInput.value = employeeToEdit.jumlah_tanggungan;
        nomorBpjsKesehatanInput.value = employeeToEdit.nomor_bpjs_kesehatan || '';
        nomorBpjsKetenagakerjaanInput.value = employeeToEdit.nomor_bpjs_ketenagakerjaan || '';
        nomorRekeningInput.value = employeeToEdit.nomor_rekening || '';
        namaBankInput.value = employeeToEdit.nama_bank || '';
        departmentIdSelect.value = employeeToEdit.department_id || '';
        managerIdSelect.value = employeeToEdit.manager_id || '';
        avatarUrlInput.value = employeeToEdit.avatar_url || '';
        avatarPreview.src = employeeToEdit.avatar_url || 'https://placehold.co/150x150/cccccc/ffffff?text=No+Photo';

        formTitle.textContent = 'Edit Karyawan';
        cancelEditButton.classList.remove('hidden');
        saveButton.innerHTML = '<i class="fas fa-save mr-2"></i> Perbarui Karyawan';
        showMessage("Mode edit aktif. Anda dapat mengubah detail karyawan.", false);

    } catch (e) {
        console.error("Error fetching employee for edit:", e);
        showMessage(`Gagal memuat data karyawan untuk diedit: ${e.message}`, true);
    }
}

// Fungsi untuk menghapus karyawan
async function deleteEmployee(id) {
    console.log("Deleting employee with ID:", id); // Debugging
    if (!confirm("Apakah Anda yakin ingin menghapus karyawan ini? Ini juga akan menghapus data terkait seperti absensi dan cuti.")) { // Menggunakan confirm() sementara
        return;
    }
    showMessage('Menghapus karyawan...', false);
    try {
        const { error } = await supabaseClient.from('employees').delete().eq('id', id);
        if (error) {
            throw error;
        }
        showMessage("Karyawan berhasil dihapus!", false);
        console.log("Employee deleted successfully."); // Debugging
        loadEmployeeList(); // Muat ulang daftar
    } catch (e) {
        console.error("Error deleting employee:", e); // Debugging
        showMessage(`Gagal menghapus karyawan: ${e.message}`, true);
    }
}

// Event listener untuk tombol Batal Edit
cancelEditButton.addEventListener('click', () => {
    employeeForm.reset();
    employeeIdInput.value = '';
    formTitle.textContent = 'Tambah Karyawan Baru';
    cancelEditButton.classList.add('hidden');
    saveButton.innerHTML = '<i class="fas fa-save mr-2"></i> Simpan Karyawan';
    avatarPreview.src = 'https://placehold.co/150x150/cccccc/ffffff?text=No+Photo';
    showMessage("Mode edit dibatalkan.", false);
});

// Event listener untuk preview avatar
avatarUrlInput.addEventListener('input', () => {
    avatarPreview.src = avatarUrlInput.value || 'https://placehold.co/150x150/cccccc/ffffff?text=No+Photo';
});


// Inisialisasi saat DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
    const hasAccess = await verifyManagerAccess();
    if (hasAccess) {
        await loadDepartments(); // Muat departemen
        await loadManagers(); // Muat manajer
        loadEmployeeList(); // Muat daftar karyawan
    } else {
        // Jika tidak memiliki akses, form dan tabel akan disembunyikan oleh verifyManagerAccess
    }
});
