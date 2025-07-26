const SUPABASE_URL = 'https://nvtedibubuiykovrtfiv.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dGVkaWJ1YnVpeWtvdnJ0Zml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTk5MzQsImV4cCI6MjA2Nzc3NTkzNH0.s5-CtQuXYAf1hQcRwljYhROibzm9U65XGxtD7LJeNVU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Mendapatkan referensi elemen DOM
const employeeSelect = document.getElementById('employee-select');
const scheduleDateInput = document.getElementById('schedule-date');
const shiftStartTimeInput = document.getElementById('shift-start-time');
const shiftEndTimeInput = document.getElementById('shift-end-time');
const scheduleUploadForm = document.getElementById('schedule-upload-form');
const statusMessageDiv = document.getElementById('status-message');
const submitButton = scheduleUploadForm.querySelector('button[type="submit"]');

// Elemen untuk Impor Excel
const excelFileInput = document.getElementById('excel-file-input');
const importExcelBtn = document.getElementById('import-excel-btn');

let currentManager = null; // Untuk menyimpan daftar manajer yang sedang login
let allEmployees = []; // Untuk menyimpan daftar karyawan dari DB (digunakan untuk validasi Excel)
let parsedExcelData = []; // Untuk menyimpan data yang diparse dari Excel

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

// Fungsi untuk memverifikasi manajer dan memuat daftar karyawan
async function verifyManagerAndLoadEmployees() {
    console.log("Verifying manager session and loading employees..."); // Debugging
    try {
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError) {
            console.error("Error getting session:", sessionError);
            showMessage("Gagal memverifikasi sesi. Mohon login ulang.", true);
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            return false;
        }
        if (!session) {
            console.log("No session found, redirecting to login.");
            showMessage("Anda belum login. Mengarahkan ke halaman login...", true);
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            return false;
        }

        // Ambil data manajer berdasarkan email yang login
        const { data: managerDataArray, error: managerError } = await supabaseClient
            .from('employees')
            .select('id, nama_lengkap, role')
            .eq('email', session.user.email)
            .limit(1);

        const managerData = managerDataArray && managerDataArray.length > 0 ? managerDataArray[0] : null;

        console.log("Manager Data:", managerData); // Debugging
        console.log("Manager Error:", managerError); // Debugging

        if (managerError || !managerData || managerData.role.toLowerCase() !== 'manager') {
            console.error("User is not a manager or data not found.");
            showMessage("Anda tidak memiliki izin untuk mengakses halaman ini.", true);
            scheduleUploadForm.innerHTML = `<p class="text-center text-red-500">Anda tidak memiliki izin untuk mengakses halaman ini.</p>`;
            return false;
        }

        currentManager = managerData;
        
        // Muat daftar karyawan untuk dropdown (dan untuk validasi Excel)
        const { data: employees, error: employeesError } = await supabaseClient
            .from('employees')
            .select('id, nama_lengkap, nik') // Ambil NIK juga untuk identifikasi unik
            .order('nama_lengkap', { ascending: true });

        console.log("Employees for dropdown/validation:", employees); // Debugging
        console.log("Employees for dropdown/validation Error:", employeesError); // Debugging

        if (employeesError) {
            throw employeesError;
        }
        if (!employees || employees.length === 0) {
            employeeSelect.innerHTML = `<option value="">Tidak ada karyawan terdaftar</option>`;
            showMessage("Tidak ada karyawan terdaftar di database.", true);
            submitButton.disabled = true;
            return false;
        }

        allEmployees = employees; // Simpan daftar karyawan
        employeeSelect.innerHTML = `<option value="">Pilih Karyawan</option>`;
        employees.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.id;
            option.textContent = emp.nama_lengkap;
            employeeSelect.appendChild(option);
        });
        
        return true;

    } catch (e) {
        console.error("Caught error in verifyManagerAndLoadEmployees:", e);
        showMessage(`Terjadi kesalahan saat memverifikasi manajer: ${e.message}`, true);
        scheduleUploadForm.innerHTML = `<p class="text-center text-red-500">Terjadi kesalahan saat memuat halaman.</p>`;
        return false;
    }
}

// Event listener untuk pengajuan formulir jadwal (manual)
scheduleUploadForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Mencegah refresh halaman

    if (!currentManager) {
        showMessage("Data manajer belum dimuat. Mohon refresh halaman.", true);
        return;
    }

    const employeeId = employeeSelect.value;
    const scheduleDate = scheduleDateInput.value;
    const shiftStartTime = shiftStartTimeInput.value;
    const shiftEndTime = shiftEndTimeInput.value;

    // Validasi input
    if (!employeeId || !scheduleDate || !shiftStartTime || !shiftEndTime) {
        showMessage("Harap isi semua kolom yang diperlukan.", true);
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Mengunggah...';
    showMessage('Mengunggah jadwal...', false);
    console.log("Submitting single schedule:", { employeeId, scheduleDate, shiftStartTime, shiftEndTime }); // Debugging

    try {
        // Simpan jadwal ke tabel 'schedules'
        const { error } = await supabaseClient
            .from('schedules')
            .insert({
                employee_id: employeeId,
                schedule_date: scheduleDate,
                shift_start_time: shiftStartTime,
                shift_end_time: shiftEndTime
            });

        if (error) {
            throw error;
        }

        showMessage("Jadwal berhasil diunggah!", false);
        console.log("Single schedule uploaded successfully."); // Debugging
        // Opsional: Reset form setelah berhasil
        scheduleUploadForm.reset();
        employeeSelect.value = ""; // Reset dropdown
        // setTimeout(() => { window.location.href = 'index.html'; }, 2000); // Kembali ke dashboard
    } catch (e) {
        console.error("Error submitting single schedule:", e); // Debugging
        showMessage(`Gagal mengunggah jadwal: ${e.message}`, true);
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-upload mr-2"></i> Upload Jadwal';
    }
});

// --- FUNGSI DAN EVENT LISTENER UNTUK IMPOR EXCEL ---

excelFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) {
        showMessage("Tidak ada file yang dipilih.", true);
        importExcelBtn.classList.add('hidden');
        return;
    }

    showMessage(`Membaca file: ${file.name}...`, false);
    importExcelBtn.classList.add('hidden'); // Sembunyikan tombol import sampai file selesai diproses

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0]; // Ambil sheet pertama
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);

            console.log("Parsed Excel JSON:", json); // Debugging

            // Validasi dan format data Excel
            const formattedData = validateAndFormatExcelData(json);
            if (formattedData.length === 0) {
                showMessage("Tidak ada data jadwal yang valid ditemukan di file Excel.", true);
                excelFileInput.value = ''; // Reset input file
                return;
            }

            parsedExcelData = formattedData; // Simpan data yang sudah diparse dan divalidasi
            showMessage(`File Excel berhasil dibaca! Ditemukan ${parsedExcelData.length} jadwal. Klik 'Impor Jadwal dari Excel' untuk mengunggah.`, false);
            importExcelBtn.classList.remove('hidden'); // Tampilkan tombol import
            
        } catch (error) {
            console.error("Error reading Excel file:", error); // Debugging
            showMessage(`Gagal membaca file Excel: ${error.message}`, true);
            excelFileInput.value = ''; // Reset input file
            importExcelBtn.classList.add('hidden');
        }
    };
    reader.readAsArrayBuffer(file);
});

importExcelBtn.addEventListener('click', async () => {
    if (parsedExcelData.length === 0) {
        showMessage("Tidak ada data untuk diimpor. Mohon pilih file Excel terlebih dahulu.", true);
        return;
    }
    if (!currentManager) {
        showMessage("Data manajer belum dimuat. Mohon refresh halaman.", true);
        return;
    }

    importExcelBtn.disabled = true;
    importExcelBtn.textContent = `Mengimpor ${parsedExcelData.length} jadwal...`;
    showMessage(`Mengimpor ${parsedExcelData.length} jadwal dari Excel...`, false);
    console.log("Starting Excel import process..."); // Debugging

    try {
        // Lakukan batch insert ke Supabase
        // Supabase mendukung insert array of objects
        const { error } = await supabaseClient
            .from('schedules')
            .insert(parsedExcelData);

        if (error) {
            throw error;
        }

        showMessage(`Berhasil mengimpor ${parsedExcelData.length} jadwal dari Excel!`, false);
        console.log("Excel schedules imported successfully."); // Debugging
        // Reset setelah berhasil
        excelFileInput.value = '';
        parsedExcelData = [];
        importExcelBtn.classList.add('hidden');
        // setTimeout(() => { window.location.href = 'index.html'; }, 2000); // Kembali ke dashboard
    } catch (e) {
        console.error("Error importing Excel schedules:", e); // Debugging
        showMessage(`Gagal mengimpor jadwal dari Excel: ${e.message}`, true);
    } finally {
        importExcelBtn.disabled = false;
        importExcelBtn.innerHTML = '<i class="fas fa-file-import mr-2"></i> Impor Jadwal dari Excel';
    }
});

// Fungsi untuk memvalidasi dan memformat data dari Excel
// Asumsi kolom Excel: No_ID_Perusahaan, Tanggal, Waktu_Mulai, Waktu_Selesai
function validateAndFormatExcelData(jsonData) {
    const validSchedules = [];
    const errors = [];

    jsonData.forEach((row, index) => {
        // Mengubah 'NIK' menjadi 'No_ID_Perusahaan'
        const noIdPerusahaan = String(row['No_ID_Perusahaan']).trim(); // Pastikan dibaca sebagai string
        const scheduleDate = row['Tanggal']; // Tanggal dalam format Excel (angka serial)
        const startTime = String(row['Waktu_Mulai']).trim();
        const endTime = String(row['Waktu_Selesai']).trim();

        // Cari employee_id berdasarkan No_ID_Perusahaan (yang sebenarnya adalah NIK di DB)
        const employee = allEmployees.find(emp => emp.nik === noIdPerusahaan); // Tetap cocokkan dengan kolom 'nik' di DB
        if (!employee) {
            errors.push(`Baris ${index + 2}: No ID Perusahaan '${noIdPerusahaan}' tidak ditemukan di database.`);
            return;
        }

        // Konversi tanggal dari format angka serial Excel ke YYYY-MM-DD
        // Excel date (serial number) to JS Date: days since 1900-01-01 (minus 1 day for Excel's 1900 leap year bug)
        const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // 1900-01-01 minus 1 day (Excel bug)
        const jsDate = new Date(excelEpoch.getTime() + (scheduleDate * 24 * 60 * 60 * 1000));
        const formattedDate = jsDate.toISOString().split('T')[0];

        // Validasi format waktu (HH:MM)
        const timeRegex = /^(?:2[0-3]|[01]?[0-9]):(?:[0-5]?[0-9])$/;
        if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
            errors.push(`Baris ${index + 2}: Format waktu tidak valid (HH:MM).`);
            return;
        }

        validSchedules.push({
            employee_id: employee.id,
            schedule_date: formattedDate,
            shift_start_time: startTime,
            shift_end_time: endTime
        });
    });

    if (errors.length > 0) {
        showMessage(`Ditemukan ${errors.length} kesalahan dalam file Excel: ${errors.join('; ')}. Hanya jadwal yang valid yang akan diimpor.`, true);
        console.error("Excel validation errors:", errors); // Debugging
    }

    return validSchedules;
}


// Inisialisasi saat DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
    const isManagerVerified = await verifyManagerAndLoadEmployees();
    if (!isManagerVerified) {
        submitButton.disabled = true;
        submitButton.textContent = 'Tidak Ada Izin';
    }
});
