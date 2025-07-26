const SUPABASE_URL = 'https://nvtedibubuiykovrtfiv.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dGVkaWJ1YnVpeWtvdnJ0Zml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTk5MzQsImV4cCI6MjA2Nzc3NTkzNH0.s5-CtQuXYAf1hQcRwljYhROibzm9U65XGxtD7LJeNVU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variabel global untuk menyimpan data laporan yang terakhir dibuat
let lastGeneratedPayrollData = []; // PENTING: Ini harus dideklarasikan secara global

// Mendapatkan referensi elemen DOM
const reportForm = document.getElementById('report-form');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const reportTbody = document.getElementById('report-tbody');
const exportBtn = document.getElementById('export-btn');
const loadingIndicator = document.getElementById('loading-indicator');
const errorMessageDiv = document.getElementById('error-message');
const payslipModal = document.getElementById('payslip-modal');
const closePayslipModalBtn = document.getElementById('close-modal-btn');
const payslipContentDiv = document.getElementById('payslip-content');
const printPayslipBtn = document.getElementById('print-payslip-btn');

// Fungsi untuk menampilkan/menyembunyikan indikator loading
function showLoading() {
    loadingIndicator.classList.remove('hidden');
    errorMessageDiv.classList.add('hidden'); // Sembunyikan pesan error saat loading
    reportTbody.innerHTML = ''; // Kosongkan tabel saat memuat
}

function hideLoading() {
    loadingIndicator.classList.add('hidden');
}

// Fungsi untuk menampilkan pesan error
function showErrorMessage(message) {
    errorMessageDiv.textContent = message;
    errorMessageDiv.classList.remove('hidden');
    hideLoading();
}

// Fungsi untuk format mata uang Rupiah
function formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 2
    }).format(amount);
}

// Fungsi untuk menghitung durasi kerja dalam jam dari check_in dan check_out
function calculateWorkHours(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0;
    const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return diffMs / (1000 * 60 * 60); // dalam jam
}

// Fungsi untuk mendapatkan PTKP berdasarkan status pajak dan jumlah tanggungan
async function getPtkp(statusPajak) { // jumlahTanggungan tidak lagi diperlukan jika PTKP sudah di tabel
    console.log("Fetching PTKP for status:", statusPajak); // Debugging
    const { data, error } = await supabaseClient
        .from('ptkp_rates')
        .select('nilai')
        .eq('status', statusPajak) // Contoh: 'K/0', 'TK/1'
        .single(); // Ambil satu baris saja

    if (error) {
        console.error('Error fetching PTKP rate:', error);
        return 0; // Kembalikan 0 jika ada error
    }
    return data ? parseFloat(data.nilai) : 0;
}

// Fungsi untuk mendapatkan tarif PPh21
async function getPPh21TaxRates() {
    console.log("Fetching PPh21 tax rates..."); // Debugging
    const { data, error } = await supabaseClient
        .from('pph21_tax_rates')
        .select('*')
        .order('batas_bawah', { ascending: true });

    if (error) {
        console.error('Error fetching PPh21 tax rates:', error);
        return [];
    }
    return data || [];
}

// Fungsi untuk mendapatkan tarif BPJS
async function getBpjsRates() {
    console.log("Fetching BPJS rates..."); // Debugging
    const { data, error } = await supabaseClient
        .from('bpjs_rates')
        .select('*');

    if (error) {
        console.error('Error fetching BPJS rates:', error);
        return [];
    }
    return data || [];
}

// Fungsi utama untuk menghitung payroll
async function calculatePayroll(employee, attendances, pph21Rates, bpjsRates) {
    console.log("Calculating payroll for employee:", employee.nama_lengkap); // Debugging
    const gajiPokokSebulan = parseFloat(employee.gaji_pokok);
    const tunjanganTetapSebulan = parseFloat(employee.tunjangan_tetap);

    // 1. Hitung Kehadiran dan Potongan Absensi
    let totalJamKerja = 0;
    let hariKerja = 0;
    let totalTerlambatMenit = 0;
    let totalCuti = 0;
    let totalIzin = 0;
    let totalSakit = 0;
    let totalAlpha = 0; // Tidak hadir tanpa keterangan

    attendances.forEach(att => {
        if (att.status_kehadiran === 'Hadir') {
            hariKerja++;
            totalJamKerja += calculateWorkHours(att.check_in, att.check_out);
        } else if (att.status_kehadiran === 'Terlambat') {
            hariKerja++; // Masih dihitung hari kerja
            // Asumsi ada kolom 'durasi_terlambat_menit' di tabel attendances
            totalTerlambatMenit += att.durasi_terlambat_menit || 0; 
            totalJamKerja += calculateWorkHours(att.check_in, att.check_out);
        } else if (att.status_kehadiran === 'Cuti') {
            totalCuti++;
        } else if (att.status_kehadiran === 'Izin') {
            totalIzin++;
        } else if (att.status_kehadiran === 'Sakit') {
            totalSakit++;
        } else if (att.status_kehadiran === 'Alpha') {
            totalAlpha++;
        }
    });

    // Contoh sederhana: potongan absensi per hari tidak masuk (Alpha)
    // Sesuaikan dengan kebijakan perusahaan Anda
    const hariKerjaDalamSebulan = 22; // Asumsi 22 hari kerja dalam sebulan
    const potonganPerHari = gajiPokokSebulan / hariKerjaDalamSebulan;
    const potonganAbsensi = totalAlpha * potonganPerHari;

    const brutoSebelumBPJS = gajiPokokSebulan + tunjanganTetapSebulan - potonganAbsensi;
    console.log(`Bruto Sebelum BPJS: ${brutoSebelumBPJS}`); // Debugging

    // 2. Perhitungan BPJS (Potongan Karyawan dan Kontribusi Perusahaan)
    let iuranBpjsKesehatanKaryawan = 0;
    let iuranJhtKaryawan = 0;
    let iuranJpKaryawan = 0;

    let kontribusiJkkPerusahaan = 0;
    let kontribusiJkPerusahaan = 0;
    let kontribusiJhtPerusahaan = 0;
    let kontribusiJpPerusahaan = 0;
    let kontribusiBpjsKesehatanPerusahaan = 0;

    // BPJS Kesehatan
    const bpjsKesRate = bpjsRates.find(r => r.jenis_bpjs === 'Kesehatan');
    if (bpjsKesRate) {
        const gajiUntukBpjsKes = Math.min(gajiPokokSebulan, parseFloat(bpjsKesRate.batas_atas_gaji || Infinity));
        iuranBpjsKesehatanKaryawan = gajiUntukBpjsKes * (parseFloat(bpjsKesRate.persentase_karyawan) / 100);
        kontribusiBpjsKesehatanPerusahaan = gajiUntukBpjsKes * (parseFloat(bpjsKesRate.persentase_perusahaan) / 100);
    }

    // JHT (Jaminan Hari Tua)
    const bpjsJhtRate = bpjsRates.find(r => r.jenis_bpjs === 'JHT');
    if (bpjsJhtRate) {
        iuranJhtKaryawan = gajiPokokSebulan * (parseFloat(bpjsJhtRate.persentase_karyawan) / 100);
        kontribusiJhtPerusahaan = gajiPokokSebulan * (parseFloat(bpjsJhtRate.persentase_perusahaan) / 100);
    }

    // JP (Jaminan Pensiun)
    const bpjsJpRate = bpjsRates.find(r => r.jenis_bpjs === 'JP');
    if (bpjsJpRate) {
        const gajiUntukBpjsJp = Math.min(gajiPokokSebulan, parseFloat(bpjsJpRate.batas_atas_gaji || Infinity));
        iuranJpKaryawan = gajiUntukBpjsJp * (parseFloat(bpjsJpRate.persentase_karyawan) / 100);
        kontribusiJpPerusahaan = gajiUntukBpjsJp * (parseFloat(bpjsJpRate.persentase_perusahaan) / 100);
    }

    // JKK (Jaminan Kecelakaan Kerja) - Hanya kontribusi perusahaan
    const jkkRate = bpjsRates.find(r => r.jenis_bpjs === 'JKK');
    if (jkkRate) {
        kontribusiJkkPerusahaan = gajiPokokSebulan * (parseFloat(jkkRate.persentase_perusahaan) / 100);
    }

    // JK (Jaminan Kematian) - Hanya kontribusi perusahaan
    const jkRate = bpjsRates.find(r => r.jenis_bpjs === 'JK');
    if (jkRate) {
        kontribusiJkPerusahaan = gajiPokokSebulan * (parseFloat(jkRate.persentase_perusahaan) / 100);
    }

    const totalPotonganBPJSKaryawan = iuranBpjsKesehatanKaryawan + iuranJhtKaryawan + iuranJpKaryawan;
    console.log(`Total Potongan BPJS Karyawan: ${totalPotonganBPJSKaryawan}`); // Debugging

    // 3. Perhitungan PPh21
    // Penghasilan Bruto PPh21 = Gaji Pokok + Tunjangan Tetap + Kontribusi BPJS Perusahaan (yang merupakan objek PPh21)
    // Asumsi: Kontribusi JKK, JK, JP Perusahaan adalah objek PPh21. BPJS Kesehatan Perusahaan BUKAN objek PPh21 bagi karyawan.
    const penghasilanBrutoPPh21 = brutoSebelumBPJS + kontribusiJkkPerusahaan + kontribusiJkPerusahaan + kontribusiJpPerusahaan;
    console.log(`Penghasilan Bruto PPh21 (Sebulan): ${penghasilanBrutoPPh21}`); // Debugging

    // Biaya Jabatan (5% dari penghasilan bruto, max 500rb/bulan atau 6jt/tahun)
    let biayaJabatan = penghasilanBrutoPPh21 * 0.05;
    biayaJabatan = Math.min(biayaJabatan, 500000); // Max 500rb per bulan
    console.log(`Biaya Jabatan: ${biayaJabatan}`); // Debugging

    // Penghasilan Netto Sebulan (setelah dikurangi biaya jabatan dan iuran BPJS karyawan yang pengurang PPh21)
    const penghasilanNettoSebulan = penghasilanBrutoPPh21 - biayaJabatan - iuranJhtKaryawan - iuranJpKaryawan;
    console.log(`Penghasilan Netto Sebulan: ${penghasilanNettoSebulan}`); // Debugging

    // Penghasilan Netto Setahun (disetahunkan)
    const penghasilanNettoSetahun = penghasilanNettoSebulan * 12;
    console.log(`Penghasilan Netto Setahun: ${penghasilanNettoSetahun}`); // Debugging

    // PTKP (Penghasilan Tidak Kena Pajak)
    const ptkpNilai = await getPtkp(employee.status_pajak);
    console.log(`PTKP Nilai (${employee.status_pajak}): ${ptkpNilai}`); // Debugging

    // PKP (Penghasilan Kena Pajak)
    let pkp = penghasilanNettoSetahun - ptkpNilai;
    pkp = Math.max(0, Math.round(pkp / 1000) * 1000); // Pembulatan ke bawah ribuan terdekat
    console.log(`PKP Setahun: ${pkp}`); // Debugging

    // PPh21 Terutang Setahun
    let pph21TerutangSetahun = 0;
    let sisaPkp = pkp;

    for (const rate of pph21Rates) {
        if (sisaPkp <= 0) break;

        const batasBawah = parseFloat(rate.batas_bawah);
        const batasAtas = parseFloat(rate.batas_atas || Infinity);
        const persentase = parseFloat(rate.persentase);

        if (pkp > batasBawah) {
            const taxableAmountInTier = Math.min(sisaPkp, batasAtas - batasBawah + 0.01); // +0.01 untuk mengakomodasi batas atas inklusif
            pph21TerutangSetahun += taxableAmountInTier * (persentase / 100);
            sisaPkp -= taxableAmountInTier;
        }
    }
    console.log(`PPh21 Terutang Setahun: ${pph21TerutangSetahun}`); // Debugging

    // PPh21 Terutang Sebulan
    const pph21TerutangSebulan = pph21TerutangSetahun / 12;
    console.log(`PPh21 Terutang Sebulan: ${pph21TerutangSebulan}`); // Debugging

    // Total Potongan (BPJS Karyawan + PPh21 Sebulan)
    const totalPotongan = totalPotonganBPJSKaryawan + pph21TerutangSebulan;
    console.log(`Total Potongan (BPJS Karyawan + PPh21): ${totalPotongan}`); // Debugging

    // Gaji Bersih
    const gajiBersih = brutoSebelumBPJS - totalPotongan;
    console.log(`Gaji Bersih: ${gajiBersih}`); // Debugging

    return {
        employeeId: employee.id,
        namaKaryawan: employee.nama_lengkap,
        hariKerja: hariKerja,
        totalTerlambatMenit: totalTerlambatMenit,
        totalCuti: totalCuti,
        totalIzin: totalIzin,
        totalSakit: totalSakit,
        totalAlpha: totalAlpha,
        totalJamKerja: totalJamKerja,
        gajiPokok: gajiPokokSebulan,
        tunjanganTetap: tunjanganTetapSebulan,
        potonganAbsensi: potonganAbsensi,
        brutoSebelumBPJS: brutoSebelumBPJS,
        iuranBpjsKesehatanKaryawan: iuranBpjsKesehatanKaryawan,
        iuranJhtKaryawan: iuranJhtKaryawan,
        iuranJpKaryawan: iuranJpKaryawan,
        totalPotonganBPJSKaryawan: totalPotonganBPJSKaryawan,
        biayaJabatan: biayaJabatan,
        penghasilanNettoSebulan: penghasilanNettoSebulan,
        penghasilanNettoSetahun: penghasilanNettoSetahun,
        ptkpNilai: ptkpNilai,
        pkp: pkp,
        pph21TerutangSetahun: pph21TerutangSetahun,
        pph21TerutangSebulan: pph21TerutangSebulan,
        totalPotongan: totalPotongan,
        gajiBersih: gajiBersih,
        // Kontribusi perusahaan (untuk informasi, tidak dipotong dari karyawan)
        kontribusiJkkPerusahaan: kontribusiJkkPerusahaan,
        kontribusiJkPerusahaan: kontribusiJkPerusahaan,
        kontribusiJhtPerusahaan: kontribusiJhtPerusahaan,
        kontribusiJpPerusahaan: kontribusiJpPerusahaan,
        kontribusiBpjsKesehatanPerusahaan: kontribusiBpjsKesehatanPerusahaan,
        jabatan: employee.jabatan // Tambahkan jabatan untuk slip gaji
    };
}


// Fungsi untuk menampilkan laporan di tabel
function displayReport(payrollData) {
    reportTbody.innerHTML = ''; // Bersihkan tabel sebelumnya

    if (payrollData.length === 0) {
        reportTbody.innerHTML = `<tr><td colspan="12" class="px-6 py-4 text-center text-gray-500">Tidak ada data payroll untuk periode ini.</td></tr>`;
        return;
    }

    payrollData.forEach(data => {
        const row = document.createElement('tr');
        row.classList.add('bg-white', 'border-b', 'hover:bg-gray-50');
        row.innerHTML = `
            <td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">${data.namaKaryawan}</td>
            <td class="px-6 py-4">${data.hariKerja}</td>
            <td class="px-6 py-4">${data.totalTerlambatMenit}</td>
            <td class="px-6 py-4">${data.totalCuti}</td>
            <td class="px-6 py-4">I:${data.totalIzin} S:${data.totalSakit} A:${data.totalAlpha}</td> <!-- Kolom Izin/Sakit/Alpha -->
            <td class="px-6 py-4">${data.totalJamKerja.toFixed(2)}</td>
            <td class="px-6 py-4">${formatRupiah(data.gajiPokok)}</td>
            <td class="px-6 py-4">${formatRupiah(data.tunjanganTetap)}</td>
            <td class="px-6 py-4">${formatRupiah(data.potonganAbsensi)}</td>
            <td class="px-6 py-4">${formatRupiah(data.totalPotonganBPJSKaryawan)}</td>
            <td class="px-6 py-4">${formatRupiah(data.pph21TerutangSebulan)}</td>
            <td class="px-6 py-4 font-bold text-green-600">${formatRupiah(data.gajiBersih)}</td>
            <td class="px-6 py-4">
                <button data-employee-id="${data.employeeId}" class="view-payslip-btn text-blue-600 hover:underline">Lihat Slip</button>
            </td>
        `;
        reportTbody.appendChild(row);
    });

    // Tambahkan event listener untuk tombol "Lihat Slip" setelah tabel di-render
    document.querySelectorAll('.view-payslip-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const employeeId = event.target.dataset.employeeId;
            const employeePayrollData = payrollData.find(p => p.employeeId === employeeId);
            if (employeePayrollData) {
                generatePayslipContent(employeePayrollData);
                payslipModal.classList.remove('hidden');
            }
        });
    });
    lastGeneratedPayrollData = payrollData; // Simpan data yang ditampilkan setelah berhasil di-render
}

// Fungsi untuk membuat konten slip gaji
function generatePayslipContent(data) {
    payslipContentDiv.innerHTML = `
        <h3 class="text-2xl font-bold text-gray-800 mb-4 text-center">SLIP GAJI</h3>
        <p class="text-center text-gray-600 mb-6">Periode: ${startDateInput.value} s/d ${endDateInput.value}</p>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-6">
            <div>
                <p class="font-semibold text-gray-800">Nama Karyawan:</p>
                <p class="text-gray-700">${data.namaKaryawan}</p>
            </div>
            <div>
                <p class="font-semibold text-gray-800">Jabatan:</p>
                <p class="text-gray-700">${data.jabatan || 'N/A'}</p> <!-- Asumsi jabatan ada di data karyawan -->
            </div>
        </div>

        <hr class="my-4 border-gray-200">
        
        <div class="grid grid-cols-2 gap-4">
            <div>
                <p class="font-semibold text-gray-800 mb-2">Penghasilan:</p>
                <p class="text-gray-700">Gaji Pokok: ${formatRupiah(data.gajiPokok)}</p>
                <p class="text-gray-700">Tunjangan Tetap: ${formatRupiah(data.tunjanganTetap)}</p>
                <p class="text-gray-700">Kontribusi JKK Perusahaan: ${formatRupiah(data.kontribusiJkkPerusahaan)}</p>
                <p class="text-gray-700">Kontribusi JK Perusahaan: ${formatRupiah(data.kontribusiJkPerusahaan)}</p>
                <p class="text-gray-700">Kontribusi JHT Perusahaan: ${formatRupiah(data.kontribusiJhtPerusahaan)}</p>
                <p class="text-gray-700">Kontribusi JP Perusahaan: ${formatRupiah(data.kontribusiJpPerusahaan)}</p>
                <p class="text-gray-700">Kontribusi BPJS Kesehatan Perusahaan: ${formatRupiah(data.kontribusiBpjsKesehatanPerusahaan)}</p>
                <p class="mt-3 font-bold text-gray-800">Total Bruto (Objek PPh21): ${formatRupiah(data.penghasilanBrutoPPh21)}</p>
                <p class="mt-3 font-bold text-gray-800">Bruto Sebelum Potongan: ${formatRupiah(data.brutoSebelumBPJS)}</p>
            </div>
            <div>
                <p class="font-semibold text-gray-800 mb-2">Potongan:</p>
                <p class="text-gray-700">Potongan Absensi: ${formatRupiah(data.potonganAbsensi)}</p>
                <p class="text-gray-700">Iuran BPJS Kesehatan (Karyawan): ${formatRupiah(data.iuranBpjsKesehatanKaryawan)}</p>
                <p class="text-gray-700">Iuran JHT (Karyawan): ${formatRupiah(data.iuranJhtKaryawan)}</p>
                <p class="text-gray-700">Iuran JP (Karyawan): ${formatRupiah(data.iuranJpKaryawan)}</p>
                <p class="text-gray-700">Biaya Jabatan: ${formatRupiah(data.biayaJabatan)}</p>
                <p class="text-gray-700">PPh21 Sebulan: ${formatRupiah(data.pph21TerutangSebulan)}</p>
                <p class="mt-3 font-bold text-gray-800">Total Potongan: ${formatRupiah(data.totalPotongan)}</p>
            </div>
        </div>
        
        <hr class="my-4 border-gray-200">
        <p class="text-2xl font-bold text-blue-600 text-right">Gaji Bersih: ${formatRupiah(data.gajiBersih)}</p>

        <div class="mt-6 text-sm text-gray-500">
            <p><strong>Rincian Absensi:</strong></p>
            <p>Hari Kerja: ${data.hariKerja}, Terlambat: ${data.totalTerlambatMenit} menit, Cuti: ${data.totalCuti} hari, Izin: ${data.totalIzin} hari, Sakit: ${data.totalSakit} hari, Alpha: ${data.totalAlpha} hari</p>
            <p>Total Jam Kerja: ${data.totalJamKerja.toFixed(2)} jam</p>
        </div>
    `;
}


// Event listener untuk form laporan
reportForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    showLoading();

    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    if (!startDate || !endDate) {
        showErrorMessage('Harap pilih tanggal mulai dan tanggal selesai.');
        return;
    }

    if (new Date(startDate) > new Date(endDate)) {
        showErrorMessage('Tanggal mulai tidak boleh lebih dari tanggal selesai.');
        return;
    }

    try {
        // Ambil data tarif PPh21 dan BPJS terlebih dahulu
        const pph21Rates = await getPPh21TaxRates();
        const bpjsRates = await getBpjsRates();

        if (pph21Rates.length === 0 || bpjsRates.length === 0) {
            showErrorMessage('Gagal memuat tarif pajak atau BPJS. Pastikan tabel terisi.');
            hideLoading();
            return;
        }

        // Ambil semua karyawan
        console.log("Fetching all employees for payroll calculation..."); // Debugging
        const { data: employees, error: employeeError } = await supabaseClient
            .from('employees')
            .select('*'); // Ambil semua kolom yang dibutuhkan

        if (employeeError) throw employeeError;
        if (!employees || employees.length === 0) {
            showErrorMessage('Tidak ada data karyawan ditemukan untuk laporan payroll.');
            hideLoading();
            return;
        }
        console.log("Employees fetched:", employees); // Debugging

        const allPayrollData = [];

        for (const employee of employees) {
            console.log(`Processing payroll for: ${employee.nama_lengkap}`); // Debugging
            // Ambil data absensi untuk karyawan dan periode ini
            const { data: attendances, error: attendanceError } = await supabaseClient
                .from('attendances')
                .select('*') // Ambil semua kolom absensi
                .eq('employee_id', employee.id)
                .gte('tanggal', startDate)
                .lte('tanggal', endDate);

            if (attendanceError) {
                console.warn(`Error fetching attendance for ${employee.nama_lengkap}:`, attendanceError.message);
                // Lanjutkan ke karyawan berikutnya jika ada error absensi
                // Atau Anda bisa memilih untuk menghentikan proses dan menampilkan error
                continue; 
            }
            console.log(`Attendances for ${employee.nama_lengkap}:`, attendances); // Debugging

            // Lakukan perhitungan payroll untuk setiap karyawan
            // Pastikan employee memiliki semua kolom yang dibutuhkan (gaji_pokok, tunjangan_tetap, status_pajak, dll.)
            const payrollResult = await calculatePayroll(employee, attendances || [], pph21Rates, bpjsRates);
            // Tambahkan jabatan ke payrollResult agar bisa ditampilkan di slip gaji
            payrollResult.jabatan = employee.jabatan; 
            payrollResult.penghasilanBrutoPPh21 = payrollResult.brutoSebelumBPJS + payrollResult.kontribusiJkkPerusahaan + payrollResult.kontribusiJkPerusahaan + payrollResult.kontribusiJpPerusahaan; // Tambahkan ini untuk slip gaji
            allPayrollData.push(payrollResult);
        }

        displayReport(allPayrollData);
        hideLoading();

    } catch (error) {
        console.error('Error generating payroll report:', error);
        showErrorMessage('Gagal membuat laporan payroll: ' + error.message);
        hideLoading();
    }
});

// Event listener untuk tombol Ekspor CSV
exportBtn.addEventListener('click', () => {
    if (lastGeneratedPayrollData.length === 0) {
        showErrorMessage('Tidak ada data laporan untuk diekspor.');
        return;
    }

    // Buat header CSV
    const headers = [
        "Nama Karyawan", "Hari Kerja", "Terlambat (Menit)", "Cuti", "Izin", "Sakit", "Alpha",
        "Total Jam Kerja", "Gaji Pokok", "Tunjangan", "Potongan Absensi", "BPJS (Potongan)",
        "PPh21", "Gaji Bersih", "Bruto Sebelum BPJS", "Penghasilan Bruto PPh21",
        "Biaya Jabatan", "Penghasilan Netto Sebulan", "Penghasilan Netto Setahun",
        "PTKP Nilai", "PKP", "PPh21 Terutang Setahun", "Kontribusi JKK Perusahaan",
        "Kontribusi JK Perusahaan", "Kontribusi JHT Perusahaan", "Kontribusi JP Perusahaan",
        "Kontribusi BPJS Kesehatan Perusahaan"
    ];

    // Buat baris data CSV
    const rows = lastGeneratedPayrollData.map(data => {
        return [
            `"${data.namaKaryawan}"`, // Gunakan kutip untuk nama yang mungkin mengandung koma
            data.hariKerja,
            data.totalTerlambatMenit,
            data.totalCuti,
            data.totalIzin,
            data.totalSakit,
            data.totalAlpha,
            data.totalJamKerja.toFixed(2),
            data.gajiPokok,
            data.tunjanganTetap,
            data.potonganAbsensi,
            data.totalPotonganBPJSKaryawan,
            data.pph21TerutangSebulan,
            data.gajiBersih,
            data.brutoSebelumBPJS,
            data.penghasilanBrutoPPh21,
            data.biayaJabatan,
            data.penghasilanNettoSebulan,
            data.penghasilanNettoSetahun,
            data.ptkpNilai,
            data.pkp,
            data.pph21TerutangSetahun,
            data.kontribusiJkkPerusahaan,
            data.kontribusiJkPerusahaan,
            data.kontribusiJhtPerusahaan,
            data.kontribusiJpPerusahaan,
            data.kontribusiBpjsKesehatanPerusahaan
        ].join(',');
    });

    // Gabungkan header dan baris data
    const csvContent = [headers.join(','), ...rows].join('\n');

    // Buat Blob dan unduh file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `laporan_payroll_${startDateInput.value}_${endDateInput.value}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showMessage('Laporan CSV berhasil diekspor!');
});


// Event listener untuk menutup modal slip gaji
closePayslipModalBtn.addEventListener('click', () => {
    payslipModal.classList.add('hidden');
});

// Event listener untuk mencetak slip gaji
printPayslipBtn.addEventListener('click', () => {
    const printContent = payslipContentDiv.innerHTML;
    const originalContent = document.body.innerHTML;

    // Buat jendela cetak baru untuk isolasi
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write('<html><head><title>Slip Gaji</title>');
    // Sertakan CSS yang relevan untuk cetak
    printWindow.document.write('<link rel="stylesheet" href="style.css">'); // Pastikan style.css dimuat
    printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>'); // Tailwind untuk cetak
    printWindow.document.write('<style>body { font-family: \'Poppins\', sans-serif; }</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(printContent);
    printWindow.document.write('</body></html>');
    printWindow.document.close();

    printWindow.onload = function() {
        printWindow.print();
        printWindow.close();
    };
});


// Inisialisasi: Set tanggal default (opsional)
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    startDateInput.value = firstDayOfMonth.toISOString().split('T')[0];
    endDateInput.value = lastDayOfMonth.toISOString().split('T')[0];
});
