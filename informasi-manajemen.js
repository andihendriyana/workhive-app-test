// manajemen-informasi.js

// Konfigurasi Supabase Anda
const SUPABASE_URL = 'https://nvtedibubuiykovrtfiv.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dGVkaWJ1YnVpeWtvdnJ0Zml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTk5MzQsImV4cCI6MjA2Nzc3NTkzNH0.s5-CtQuXYAf1hQcRwljYhROibzm9U65XGxtD7LJeNVU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Mendapatkan referensi elemen DOM
const statusMessageDiv = document.getElementById('status-message');
const infoForm = document.getElementById('info-form');
const infoIdInput = document.getElementById('info-id');
const infoTitleInput = document.getElementById('info-title');
const infoCategorySelect = document.getElementById('info-category');
const infoContentInput = document.getElementById('info-content');
const infoFileInput = document.getElementById('info-file');
const formTitle = document.getElementById('form-title');
const saveButton = infoForm.querySelector('button[type="submit"]');
const cancelEditButton = document.getElementById('cancel-edit-btn');
const infoTbody = document.getElementById('info-tbody');

let currentManager = null; // Untuk menyimpan data manajer yang sedang login
let currentEditId = null; // Untuk melacak ID informasi yang sedang diedit
let companyInfoSubscription = null; // Untuk menyimpan objek langganan realtime

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
async function verifyManager() {
    console.log("VerifyManager - Verifying manager session for info management..."); // Debugging
    try {
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        console.log("VerifyManager - Session:", session); // Debugging
        if (sessionError) {
            console.error("VerifyManager - Error getting session:", sessionError);
            showMessage("Gagal memverifikasi sesi. Mohon login ulang.", true);
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            return false;
        }
        if (!session) {
            console.log("VerifyManager - No session found, redirecting to login.");
            showMessage("Anda belum login. Mengarahkan ke halaman login...", true);
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            return false;
        }
        console.log("VerifyManager - Logged in user email:", session.user.email); // Debugging

        const { data: managerDataArray, error: managerError } = await supabaseClient
            .from('employees')
            .select('id, role, email') // Tambahkan 'email' untuk debugging
            .eq('email', session.user.email)
            .limit(1);

        const managerData = managerDataArray && managerDataArray.length > 0 ? managerDataArray[0] : null;

        console.log("VerifyManager - Raw response from DB:", managerDataArray); // Debugging
        console.log("VerifyManager - Manager Data from DB:", managerData); // Debugging
        console.log("VerifyManager - Manager Error from DB:", managerError); // Debugging

        if (managerError) {
            console.error("VerifyManager - Error fetching manager data:", managerError);
            showMessage(`Gagal memverifikasi data manajer: ${managerError.message}`, true);
            document.body.innerHTML = `<div class="flex items-center justify-center h-screen text-red-500 text-xl">Terjadi kesalahan saat memuat halaman.</div>`;
            return false;
        }
        if (!managerData) {
            console.log("VerifyManager - No employee data found for this user."); // Debugging
            showMessage("Profil karyawan tidak ditemukan. Pastikan email Anda terdaftar di tabel karyawan.", true);
            document.body.innerHTML = `<div class="flex items-center justify-center h-screen text-red-500 text-xl">Profil karyawan tidak ditemukan.</div>`;
            return false;
        }
        if (managerData.role.toLowerCase() !== 'manager') {
            console.log("VerifyManager - User role is not 'manager':", managerData.role); // Debugging
            showMessage("Anda tidak memiliki izin untuk mengakses halaman ini.", true);
            document.body.innerHTML = `<div class="flex items-center justify-center h-screen text-red-500 text-xl">Anda tidak memiliki izin untuk mengakses halaman ini.</div>`;
            return false;
        }

        currentManager = managerData;
        console.log("VerifyManager - Manager successfully verified:", currentManager); // Debugging
        return true;

    } catch (e) {
        console.error("VerifyManager - Caught error in verifyManager:", e);
        showMessage(`Terjadi kesalahan saat memverifikasi manajer: ${e.message}`, true);
        document.body.innerHTML = `<div class="flex items-center justify-center h-screen text-red-500 text-xl">Terjadi kesalahan saat memuat halaman.</div>`;
        return false;
    }
}

// Fungsi untuk memuat daftar informasi perusahaan (dipanggil oleh realtime listener)
async function loadAndDisplayCompanyInfoFromDB() {
    console.log("loadAndDisplayCompanyInfoFromDB - Realtime triggered: Reloading company info from DB..."); // Debugging
    infoTbody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">Memuat informasi...</td></tr>`; // Reset loading state

    try {
        const { data: infoList, error } = await supabaseClient
            .from('company_info')
            .select('*')
            .order('created_at', { ascending: false }, { reload: true }); // Force reload for display

        console.log("loadAndDisplayCompanyInfoFromDB - Company Info List Data:", infoList); // Debugging
        console.log("loadAndDisplayCompanyInfoFromDB - Company Info List Error:", error); // Debugging

        if (error) {
            throw error;
        }
        displayCompanyInfoList(infoList); // Panggil fungsi tampilan
    } catch (e) {
        console.error("loadAndDisplayCompanyInfoFromDB - Error reloading company info via realtime:", e);
        showMessage(`Gagal memperbarui daftar informasi secara realtime: ${e.message}`, true);
        infoTbody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-red-500">Gagal memuat daftar informasi: ${e.message}</td></tr>`;
    }
}

// Fungsi untuk menampilkan daftar informasi perusahaan di tabel
function displayCompanyInfoList(infoList) {
    if (!infoList || infoList.length === 0) {
        infoTbody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">Tidak ada informasi yang tersedia.</td></tr>`;
        return;
    }

    infoTbody.innerHTML = ''; // Bersihkan tabel
    infoList.forEach(info => {
        const row = document.createElement('tr');
        row.classList.add('bg-white', 'border-b', 'hover:bg-gray-50');

        row.innerHTML = `
            <td class="px-6 py-4 font-medium text-gray-900">${info.judul}</td>
            <td class="px-6 py-4">${info.kategori}</td>
            <td class="px-6 py-4">
                ${info.url_dokumen ? `<a href="${info.url_dokumen}" target="_blank" class="text-blue-600 hover:underline"><i class="fas fa-file-alt mr-1"></i> Lihat Dokumen</a>` : 'Tidak ada'}
            </td>
            <td class="px-6 py-4 space-x-2">
                <button class="edit-btn bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-1 px-3 rounded-lg text-xs" data-id="${info.id}">Edit</button>
                <button class="delete-btn bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-lg text-xs" data-id="${info.id}">Hapus</button>
            </td>
        `;
        infoTbody.appendChild(row);
    });

    // Tambahkan event listener untuk tombol aksi
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', () => editInfo(button.dataset.id));
    });
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', () => deleteInfo(button.dataset.id));
    });
}


// Event listener untuk form unggah/edit informasi
infoForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Mencegah refresh halaman

    if (!currentManager) {
        showMessage("Data manajer belum dimuat. Mohon refresh halaman.", true);
        return;
    }

    const judul = infoTitleInput.value.trim();
    const kategori = infoCategorySelect.value;
    const konten = infoContentInput.value.trim();
    const file = infoFileInput.files[0];
    const infoId = infoIdInput.value; // ID jika sedang edit

    if (!judul || !kategori) {
        showMessage("Judul dan Kategori harus diisi.", true);
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = 'Menyimpan...';
    showMessage('Menyimpan informasi...', false);
    console.log("infoForm.submit - Submitting info:", { judul, kategori, konten, file: file ? file.name : 'none', infoId }); // Debugging

    let fileUrl = '';
    try {
        if (file) {
            // Upload file ke Supabase Storage
            const fileName = `company-info-${Date.now()}-${file.name}`;
            console.log("infoForm.submit - Uploading file to storage:", fileName); // Debugging
            const { data: uploadData, error: uploadError } = await supabaseClient.storage.from('company-documents').upload(fileName, file);
            if (uploadError) {
                throw uploadError;
            }
            const { data: urlData } = supabaseClient.storage.from('company-documents').getPublicUrl(fileName);
            fileUrl = urlData.publicUrl;
            console.log("infoForm.submit - File uploaded, URL:", fileUrl); // Debugging
        }

        const infoData = {
            judul: judul,
            kategori: kategori,
            konten: konten || null, // Simpan null jika kosong
            url_dokumen: fileUrl || null, // Simpan null jika tidak ada file
            diunggah_oleh: currentManager.id // ID manajer yang mengunggah
        };

        let error;
        if (infoId) { // Mode Edit
            console.log("infoForm.submit - Updating existing info:", infoId, infoData); // Debugging
            ({ error } = await supabaseClient.from('company_info').update(infoData).eq('id', infoId));
        } else { // Mode Unggah Baru
            console.log("infoForm.submit - Inserting new info:", infoData); // Debugging
            ({ error } = await supabaseClient.from('company_info').insert(infoData));
        }

        if (error) {
            throw error;
        }

        showMessage("Informasi berhasil disimpan!", false);
        console.log("infoForm.submit - Info saved successfully."); // Debugging
        infoForm.reset(); // Reset form
        infoFileInput.value = ''; // Reset input file
        currentEditId = null; // Reset mode edit
        formTitle.textContent = 'Unggah Informasi Baru';
        cancelEditButton.classList.add('hidden');
        saveButton.innerHTML = '<i class="fas fa-save mr-2"></i> Simpan Informasi';
        // Realtime listener akan memicu pembaruan otomatis, tidak perlu reload manual di sini
    } catch (e) {
        console.error("infoForm.submit - Error saving info:", e); // Debugging
        showMessage(`Gagal menyimpan informasi: ${e.message}`, true);
    } finally {
        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="fas fa-save mr-2"></i> Simpan Informasi';
    }
});

// Fungsi untuk mengisi form saat mode edit
async function editInfo(id) {
    console.log("editInfo - Editing info with ID:", id); // Debugging
    try {
        const { data: infoToEdit, error } = await supabaseClient
            .from('company_info')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            throw error;
        }
        if (!infoToEdit) {
            showMessage("Informasi tidak ditemukan.", true);
            return;
        }

        infoIdInput.value = infoToEdit.id;
        infoTitleInput.value = infoToEdit.judul;
        infoCategorySelect.value = infoToEdit.kategori;
        infoContentInput.value = infoToEdit.konten || '';
        // infoFileInput tidak bisa diisi ulang secara programatis karena alasan keamanan
        cancelEditButton.classList.remove('hidden');
        saveButton.innerHTML = '<i class="fas fa-save mr-2"></i> Perbarui Informasi';
        showMessage("Mode edit aktif. Anda dapat mengubah detail informasi.", false);

    } catch (e) {
        console.error("editInfo - Error fetching info for edit:", e);
        showMessage(`Gagal memuat informasi untuk diedit: ${e.message}`, true);
    }
}

// Fungsi untuk menghapus informasi
async function deleteInfo(id) {
    console.log("deleteInfo - Deleting info with ID:", id); // Debugging
    if (!confirm("Apakah Anda yakin ingin menghapus informasi ini?")) { // Menggunakan confirm() sementara
        return;
    }
    showMessage('Menghapus informasi...', false);
    try {
        // Hapus file dari storage jika ada
        const { data: infoToDelete, error: fetchError } = await supabaseClient
            .from('company_info')
            .select('url_dokumen')
            .eq('id', id)
            .single();

        if (fetchError) {
            throw fetchError;
        }
        if (!infoToDelete) { // Pastikan infoToDelete ditemukan
            console.warn("deleteInfo - Info to delete not found in DB, but proceeding with delete.");
        }

        if (infoToDelete && infoToDelete.url_dokumen) {
            const fileName = infoToDelete.url_dokumen.split('/').pop(); // Ambil nama file dari URL
            console.log("deleteInfo - Attempting to delete file from storage:", fileName); // Debugging
            const { error: deleteFileError } = await supabaseClient.storage.from('company-documents').remove([fileName]);
            if (deleteFileError) {
                console.warn("deleteInfo - Gagal menghapus file dari storage:", deleteFileError.message);
                // Lanjutkan penghapusan entri DB meskipun file gagal dihapus
            } else {
                console.log("deleteInfo - File successfully deleted from storage.");
            }
        }

        // Hapus entri dari database
        const { error } = await supabaseClient.from('company_info').delete().eq('id', id);
        if (error) {
            throw error;
        }
        showMessage("Informasi berhasil dihapus!", false);
        console.log("deleteInfo - Info deleted successfully."); // Debugging
        // Realtime listener akan memicu pembaruan otomatis, tidak perlu reload manual di sini
    } catch (e) {
        console.error("deleteInfo - Error deleting info:", e); // Debugging
        showMessage(`Gagal menghapus informasi: ${e.message}`, true);
    }
}

// Event listener untuk tombol Batal Edit
cancelEditButton.addEventListener('click', () => {
    infoForm.reset();
    infoFileInput.value = '';
    currentEditId = null;
    formTitle.textContent = 'Unggah Informasi Baru';
    cancelEditButton.classList.add('hidden');
    saveButton.innerHTML = '<i class="fas fa-save mr-2"></i> Simpan Informasi';
    showMessage("Mode edit dibatalkan.", false);
});

// Inisialisasi saat DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
    const isManager = await verifyManager();
    if (isManager) {
        // Panggil fungsi untuk mengambil dan menampilkan data awal
        loadAndDisplayCompanyInfoFromDB(); 

        // Setup Realtime Listener
        // Hentikan langganan sebelumnya jika ada untuk menghindari duplikasi listener
        if (companyInfoSubscription) {
            companyInfoSubscription.unsubscribe();
        }

        companyInfoSubscription = supabaseClient
            .channel('public:company_info') // Nama channel
            .on('postgres_changes', { 
                event: '*', // Dengarkan semua event (INSERT, UPDATE, DELETE)
                schema: 'public',
                table: 'company_info'
            }, (payload) => {
                console.log('Realtime change received for company_info!', payload); // Debugging realtime
                // Saat ada perubahan, muat ulang data dari database
                loadAndDisplayCompanyInfoFromDB();
            })
            .subscribe();
    } else {
        // Jika tidak memiliki akses, form dan tabel akan disembunyikan oleh verifyManagerAccess
        console.log("User is not a manager, hiding form and table."); // Debugging
        infoForm.style.display = 'none';
        document.querySelector('.data-table-container').style.display = 'none';
        // Tampilkan pesan "Anda tidak memiliki izin" di body jika belum ditampilkan
        if (!document.body.innerHTML.includes("Anda tidak memiliki izin untuk mengakses halaman ini.")) {
            document.body.innerHTML = `<div class="flex items-center justify-center h-screen text-red-500 text-xl">Anda tidak memiliki izin untuk mengakses halaman ini.</div>`;
        }
    }
});

// Pastikan untuk menghentikan langganan realtime saat halaman ditutup/dinavigasi
window.addEventListener('beforeunload', () => {
    if (companyInfoSubscription) {
        companyInfoSubscription.unsubscribe();
        console.log("Company Info Realtime subscription unsubscribed.");
    }
});
