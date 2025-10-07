import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const exportToExcel = (rows, filename = 'Comparison_Export.xlsx') => {
    if (!rows || rows.length === 0) return;

    const sanitized = rows.map(row => {
        const copy = {};
        Object.keys(row).forEach(k => {
            copy[k] = row[k] === '' || row[k] == null ? 'N/A' : row[k];
        });
        return copy;
    });

    const worksheet = XLSX.utils.json_to_sheet(sanitized);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Comparison Result');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(data, filename);
};

export const exportToPDF = (rows, filename = 'Comparison_Report.pdf') => {
    if (!rows || rows.length === 0) return;

    const firstRow = rows[0];
    const columns = Object.keys(firstRow);
    if (columns.length > 6) {
        alert('Too many columns for PDF export. Please hide some columns or use Excel export.');
        return;
    }

    const doc = new jsPDF();
    const tableBody = rows.map(row =>
        columns.map(k => (row[k] === '' || row[k] == null ? 'N/A' : row[k]))
    );

    doc.text('BOM Comparison Report', 14, 14);
    doc.autoTable({
        head: [columns],
        body: tableBody,
        startY: 20,
        styles: { fontSize: 8 },
    });

    doc.save(filename);
};

export const emailReport = () => {
    alert('📧 Email functionality is under development.');
};
