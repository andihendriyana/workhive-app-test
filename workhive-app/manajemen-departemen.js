const SUPABASE_URL = 'https://nvtedibubuiykovrtfiv.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dGVkaWJ1YnVpeWtvdnJ0Zml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTk5MzQsImV4cCI6MjA2Nzc3NTkzNH0.s5-CtQuXYAf1hQcRwljYhROibzm9U65XGxtD7LJeNVU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Mendapatkan referensi elemen DOM
const statusMessageDiv = document.getElementById('status-message');
const departmentForm = document.getElementById('department-form');
const departmentIdInput = document.getElementById('department-id');
const namaDepartemenInput = document.getElementById('nama-departemen');
const deskripsiDepartemenInput = document.getElementById('deskripsi-departemen');
const formTitle = document.getElementById('form-title');
const saveButton = departmentForm.querySelector('button[type="submit"]');
const cancelEditButton = document.getElementById('cancel-edit-btn');
const departmentTbody = document.getElementById('department-tbody');

let currentEditId = null; // Untuk melacak ID departemen yang sedang diedit

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

// Fungsi untuk memverifikasi manajer (hanya manajer yang bisa akses halaman ini)
async function verifyManagerAccess() {
    console.log("Verifying manager access for department management..."); // Debugging
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
        console.log("VerifyManagerAccess - Manager successfully verified."); // Debugging
        return true;

    } catch (e) {
        console.error("VerifyManagerAccess - Caught error in verifyManagerAccess:", e);
        showMessage(`Terjadi kesalahan saat memverifikasi akses: ${e.message}`, true);
        document.body.innerHTML = `<div class="flex items-center justify-center h-screen text-red-500 text-xl">Terjadi kesalahan saat memuat halaman.</div>`;
        return false;
    }
}

// Fungsi untuk memuat daftar departemen
async function loadDepartmentList() {
    console.log("Loading department list..."); // Debugging
    departmentTbody.innerHTML = `<tr><td colspan="3" class="px-6 py-4 text-center text-gray-500">Memuat departemen...</td></tr>`;

    try {
        const { data: departments, error } = await supabaseClient
            .from('departments')
            .select('*') // Ambil semua kolom
            .order('name', { ascending: true }); // Order by 'name' (sesuai skema DB Anda)

        console.log("Department List Data:", departments); // Debugging
        console.log("Department List Error:", error); // Debugging

        if (error) {
            throw error;
        }
        if (!departments || departments.length === 0) {
            departmentTbody.innerHTML = `<tr><td colspan="3" class="px-6 py-4 text-center text-gray-500">Tidak ada departemen terdaftar.</td></tr>`;
            return;
        }

        departmentTbody.innerHTML = ''; // Bersihkan tabel
        departments.forEach(dept => {
            const row = document.createElement('tr');
            row.classList.add('bg-white', 'border-b', 'hover:bg-gray-50');
            
            // Gunakan nama kolom yang benar: 'name'
            const departmentName = dept.name || 'N/A';
            const departmentDesc = dept.deskripsi || 'Tidak ada deskripsi';

            row.innerHTML = `
                <td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">${departmentName}</td>
                <td class="px-6 py-4">${departmentDesc}</td>
                <td class="px-6 py-4 space-x-2">
                    <button class="edit-btn bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-1 px-3 rounded-lg text-xs" data-id="${dept.id}">Edit</button>
                    <button class="delete-btn bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-lg text-xs" data-id="${dept.id}">Hapus</button>
                </td>
            `;
            departmentTbody.appendChild(row);
        });

        // Tambahkan event listener untuk tombol aksi
        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', () => editDepartment(button.dataset.id));
        });
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', () => deleteDepartment(button.dataset.id));
        });

    } catch (e) {
        console.error("Caught error loading department list:", e);
        departmentTbody.innerHTML = `<p class="text-red-500">Gagal memuat daftar departemen: ${e.message}</p>`;
    }
}

// Event listener untuk form tambah/edit departemen
departmentForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Mencegah refresh halaman

    const departmentId = departmentIdInput.value; // ID jika sedang edit
    const namaDepartemen = namaDepartemenInput.value.trim();
    const deskripsiDepartemen = deskripsiDepartemenInput.value.trim();

    // Validasi dasar
    if (!namaDepartemen) {
        showMessage("Nama Departemen harus diisi.", true);
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = 'Menyimpan...';
    showMessage('Menyimpan data departemen...', false);
    console.log("Submitting department data:", { namaDepartemen, departmentId }); // Debugging

    const departmentData = {
        name: namaDepartemen, // Gunakan 'name' sesuai skema DB Anda
        deskripsi: deskripsiDepartemen || null
    };

    try {
        let error;
        if (departmentId) { // Mode Edit
            console.log("Updating existing department:", departmentId, departmentData); // Debugging
            ({ error } = await supabaseClient.from('departments').update(departmentData).eq('id', departmentId));
        } else { // Mode Tambah Baru
            console.log("Inserting new department:", departmentData); // Debugging
            ({ error } = await supabaseClient.from('departments').insert(departmentData));
        }

        if (error) {
            throw error;
        }

        showMessage("Departemen berhasil disimpan!", false);
        console.log("Department data saved successfully."); // Debugging
        departmentForm.reset(); // Reset form
        departmentIdInput.value = ''; // Reset ID
        formTitle.textContent = 'Tambah Departemen Baru';
        cancelEditButton.classList.add('hidden');
        saveButton.innerHTML = '<i class="fas fa-save mr-2"></i> Simpan Departemen';
        loadDepartmentList(); // Muat ulang daftar
    } catch (e) {
        console.error("Error saving department data:", e); // Debugging
        showMessage(`Gagal menyimpan data departemen: ${e.message}`, true);
    } finally {
        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="fas fa-save mr-2"></i> Simpan Departemen';
    }
});

// Fungsi untuk mengisi form saat mode edit
async function editDepartment(id) {
    console.log("Editing department with ID:", id); // Debugging
    try {
        const { data: departmentToEdit, error } = await supabaseClient
            .from('departments')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            throw error;
        }
        if (!departmentToEdit) {
            showMessage("Departemen tidak ditemukan.", true);
            return;
        }

        departmentIdInput.value = departmentToEdit.id;
        namaDepartemenInput.value = departmentToEdit.name; // Gunakan 'name'
        deskripsiDepartemenInput.value = departmentToEdit.deskripsi || '';

        formTitle.textContent = 'Edit Departemen';
        cancelEditButton.classList.remove('hidden');
        saveButton.innerHTML = '<i class="fas fa-save mr-2"></i> Perbarui Departemen';
        showMessage("Mode edit aktif. Anda dapat mengubah detail departemen.", false);

    } catch (e) {
        console.error("Error fetching department for edit:", e);
        showMessage(`Gagal memuat data departemen untuk diedit: ${e.message}`, true);
    }
}

// Fungsi untuk menghapus departemen
async function deleteDepartment(id) {
    console.log("Deleting department with ID:", id); // Debugging
    if (!confirm("Apakah Anda yakin ingin menghapus departemen ini? Ini akan memengaruhi karyawan yang terkait.")) { // Menggunakan confirm() sementara
        return;
    }
    showMessage('Menghapus departemen...', false);
    try {
        const { error } = await supabaseClient.from('departments').delete().eq('id', id);
        if (error) {
            throw error;
        }
        showMessage("Departemen berhasil dihapus!", false);
        console.log("Department deleted successfully."); // Debugging
        loadDepartmentList(); // Muat ulang daftar
    } catch (e) {
        console.error("Error deleting department:", e); // Debugging
        showMessage(`Gagal menghapus departemen: ${e.message}`, true);
    }
}

// Event listener untuk tombol Batal Edit
cancelEditButton.addEventListener('click', () => {
    departmentForm.reset();
    departmentIdInput.value = '';
    formTitle.textContent = 'Tambah Departemen Baru';
    cancelEditButton.classList.add('hidden');
    saveButton.innerHTML = '<i class="fas fa-save mr-2"></i> Simpan Departemen';
    showMessage("Mode edit dibatalkan.", false);
});

// Inisialisasi saat DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
    const hasAccess = await verifyManagerAccess();
    if (hasAccess) {
        loadDepartmentList(); // Muat daftar departemen
    } else {
        // Jika tidak memiliki akses, form dan tabel akan disembunyikan oleh verifyManagerAccess
    }
});
