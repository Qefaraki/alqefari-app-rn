import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { captureRef } from "react-native-view-shot";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { toArabicNumerals } from "../utils/arabicHelpers";

/**
 * Export Service - Handles PDF, CSV, and Image exports
 */
class ExportService {
  constructor() {
    this.exportDir = `${FileSystem.documentDirectory}exports/`;
    this.ensureExportDirectory();
  }

  async ensureExportDirectory() {
    const dirInfo = await FileSystem.getInfoAsync(this.exportDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.exportDir, {
        intermediates: true,
      });
    }
  }

  /**
   * Export family tree as PDF
   * @param {Array} profiles - Array of profile objects
   * @param {Object} options - Export options
   * @returns {Promise<{success: boolean, uri?: string, error?: string}>}
   */
  async exportToPDF(profiles, options = {}) {
    try {
      const {
        title = "شجرة عائلة القفاري",
        includePhotos = true,
        includeMarriages = true,
        includeDates = true,
        rtl = true,
      } = options;

      // Generate HTML content
      const html = this.generatePDFHTML(profiles, {
        title,
        includePhotos,
        includeMarriages,
        includeDates,
        rtl,
      });

      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      // Move to exports directory with proper name
      const fileName = `family_tree_${Date.now()}.pdf`;
      const finalUri = `${this.exportDir}${fileName}`;
      await FileSystem.moveAsync({
        from: uri,
        to: finalUri,
      });

      // Share the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(finalUri, {
          mimeType: "application/pdf",
          dialogTitle: "مشاركة شجرة العائلة",
          UTI: "com.adobe.pdf",
        });
      }

      return { success: true, uri: finalUri };
    } catch (error) {
      console.error("PDF export error:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate HTML for PDF export
   */
  generatePDFHTML(profiles, options) {
    const { title, includePhotos, includeMarriages, includeDates, rtl } =
      options;

    // Group profiles by generation
    const generations = {};
    profiles.forEach((profile) => {
      const gen = profile.generation || 0;
      if (!generations[gen]) generations[gen] = [];
      generations[gen].push(profile);
    });

    // Sort each generation by sibling_order
    Object.keys(generations).forEach((gen) => {
      generations[gen].sort(
        (a, b) => (a.sibling_order || 0) - (b.sibling_order || 0),
      );
    });

    const profileCards = Object.keys(generations)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map((gen) => {
        const genProfiles = generations[gen];
        const genCards = genProfiles
          .map((profile) =>
            this.generateProfileCard(profile, {
              includePhotos,
              includeMarriages,
              includeDates,
            }),
          )
          .join("");

        return `
          <div class="generation">
            <h2>الجيل ${toArabicNumerals(gen)}</h2>
            <div class="profiles-grid">
              ${genCards}
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <!DOCTYPE html>
      <html dir="${rtl ? "rtl" : "ltr"}" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Noto Kufi Arabic', 'SF Arabic', -apple-system, sans-serif;
            background: #f5f5f5;
            color: #1a1a1a;
            direction: ${rtl ? "rtl" : "ltr"};
            padding: 20px;
          }
          
          .header {
            text-align: center;
            padding: 30px 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 12px;
            margin-bottom: 30px;
          }
          
          .header h1 {
            font-size: 36px;
            font-weight: 700;
            margin-bottom: 10px;
          }
          
          .header .date {
            font-size: 14px;
            opacity: 0.9;
          }
          
          .generation {
            margin-bottom: 40px;
          }
          
          .generation h2 {
            font-size: 24px;
            color: #333;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #667eea;
          }
          
          .profiles-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
          }
          
          .profile-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            page-break-inside: avoid;
          }
          
          .profile-header {
            display: flex;
            align-items: center;
            margin-bottom: 15px;
            gap: 15px;
          }
          
          .profile-photo {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            font-weight: bold;
            flex-shrink: 0;
          }
          
          .profile-photo img {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
          }
          
          .profile-info h3 {
            font-size: 18px;
            color: #333;
            margin-bottom: 5px;
          }
          
          .profile-info .hid {
            font-size: 12px;
            color: #666;
            font-family: monospace;
          }
          
          .profile-details {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #eee;
          }
          
          .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 14px;
          }
          
          .detail-label {
            color: #666;
          }
          
          .detail-value {
            color: #333;
            font-weight: 500;
          }
          
          .marriages {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #eee;
          }
          
          .marriage-item {
            background: #f8f8f8;
            padding: 10px;
            border-radius: 8px;
            margin-bottom: 8px;
            font-size: 14px;
          }
          
          .footer {
            margin-top: 50px;
            text-align: center;
            padding: 20px;
            background: #f8f8f8;
            border-radius: 12px;
            font-size: 12px;
            color: #666;
          }
          
          @media print {
            body {
              padding: 0;
              background: white;
            }
            
            .profile-card {
              box-shadow: none;
              border: 1px solid #ddd;
            }
            
            .header {
              background: #667eea !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${title}</h1>
          <div class="date">تم التصدير: ${format(new Date(), "dd MMMM yyyy", { locale: ar })}</div>
        </div>
        
        ${profileCards}
        
        <div class="footer">
          <p>تم إنشاء هذا التقرير من تطبيق شجرة عائلة القفاري</p>
          <p>جميع الحقوق محفوظة © ${new Date().getFullYear()}</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate individual profile card HTML
   */
  generateProfileCard(profile, options) {
    const { includePhotos, includeMarriages, includeDates } = options;

    const initial = profile.name ? profile.name.charAt(0) : "؟";
    const photoSection =
      includePhotos && profile.photo_url
        ? `<img src="${profile.photo_url}" alt="${profile.name}" />`
        : initial;

    const details = [];

    if (profile.gender) {
      details.push(`
        <div class="detail-row">
          <span class="detail-label">الجنس:</span>
          <span class="detail-value">${profile.gender === "male" ? "ذكر" : "أنثى"}</span>
        </div>
      `);
    }

    if (includeDates && profile.birth_year_hijri) {
      details.push(`
        <div class="detail-row">
          <span class="detail-label">سنة الميلاد:</span>
          <span class="detail-value">${toArabicNumerals(profile.birth_year_hijri)} هـ</span>
        </div>
      `);
    }

    if (includeDates && profile.death_year_hijri) {
      details.push(`
        <div class="detail-row">
          <span class="detail-label">سنة الوفاة:</span>
          <span class="detail-value">${toArabicNumerals(profile.death_year_hijri)} هـ</span>
        </div>
      `);
    }

    if (profile.current_residence) {
      details.push(`
        <div class="detail-row">
          <span class="detail-label">مكان الإقامة:</span>
          <span class="detail-value">${profile.current_residence}</span>
        </div>
      `);
    }

    const marriageSection =
      includeMarriages && profile.marriages && profile.marriages.length > 0
        ? `
        <div class="marriages">
          <strong>حالات الزواج:</strong>
          ${profile.marriages
            .map(
              (m) => `
            <div class="marriage-item">
              ${m.spouse_name || "غير محدد"} - ${m.status === "married" ? "متزوج" : m.status}
            </div>
          `,
            )
            .join("")}
        </div>
      `
        : "";

    return `
      <div class="profile-card">
        <div class="profile-header">
          <div class="profile-photo">
            ${photoSection}
          </div>
          <div class="profile-info">
            <h3>${profile.name || "بدون اسم"}</h3>
            <div class="hid">${profile.hid || "بدون معرف"}</div>
          </div>
        </div>
        ${
          details.length > 0
            ? `
          <div class="profile-details">
            ${details.join("")}
          </div>
        `
            : ""
        }
        ${marriageSection}
      </div>
    `;
  }

  /**
   * Export data as CSV
   * @param {Array} profiles - Array of profile objects
   * @param {Object} options - Export options
   * @returns {Promise<{success: boolean, uri?: string, error?: string}>}
   */
  async exportToCSV(profiles, options = {}) {
    try {
      const {
        includeMarriages = true,
        includeDates = true,
        includeContact = false,
      } = options;

      // Generate CSV content
      const csv = this.generateCSV(profiles, {
        includeMarriages,
        includeDates,
        includeContact,
      });

      // Save CSV file
      const fileName = `family_data_${Date.now()}.csv`;
      const fileUri = `${this.exportDir}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Share the CSV
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: "مشاركة بيانات العائلة",
          UTI: "public.comma-separated-values-text",
        });
      }

      return { success: true, uri: fileUri };
    } catch (error) {
      console.error("CSV export error:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate CSV content
   */
  generateCSV(profiles, options) {
    const { includeMarriages, includeDates, includeContact } = options;

    // Define headers
    const headers = [
      "المعرف",
      "الاسم",
      "الكنية",
      "اللقب",
      "الجنس",
      "الجيل",
      "ترتيب الأخوة",
      "معرف الأب",
      "اسم الأب",
      "معرف الأم",
      "اسم الأم",
    ];

    if (includeDates) {
      headers.push("سنة الميلاد هجري", "سنة الوفاة هجري");
    }

    if (includeContact) {
      headers.push("البريد الإلكتروني", "الهاتف", "مكان الإقامة");
    }

    if (includeMarriages) {
      headers.push("عدد حالات الزواج", "أسماء الأزواج والزوجات");
    }

    // Create parent lookup map
    const profileMap = {};
    profiles.forEach((p) => {
      profileMap[p.id] = p;
    });

    // Generate rows
    const rows = profiles.map((profile) => {
      const row = [
        profile.hid || "",
        profile.name || "",
        profile.kunya || "",
        profile.nickname || "",
        profile.gender === "male"
          ? "ذكر"
          : profile.gender === "female"
            ? "أنثى"
            : "",
        profile.generation || "",
        profile.sibling_order || "",
        profile.father_id || "",
        profile.father_id && profileMap[profile.father_id]
          ? profileMap[profile.father_id].name
          : "",
        profile.mother_id || "",
        profile.mother_id && profileMap[profile.mother_id]
          ? profileMap[profile.mother_id].name
          : "",
      ];

      if (includeDates) {
        row.push(
          profile.birth_year_hijri || "",
          profile.death_year_hijri || "",
        );
      }

      if (includeContact) {
        row.push(
          profile.email || "",
          profile.phone || "",
          profile.current_residence || "",
        );
      }

      if (includeMarriages) {
        const marriageCount = profile.marriages ? profile.marriages.length : 0;
        const spouseNames = profile.marriages
          ? profile.marriages.map((m) => m.spouse_name || "غير محدد").join("، ")
          : "";
        row.push(marriageCount, spouseNames);
      }

      return row;
    });

    // Add BOM for proper UTF-8 encoding in Excel
    const BOM = "\uFEFF";

    // Convert to CSV format
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) => {
            // Escape quotes and wrap in quotes if contains comma or quotes
            const cellStr = String(cell);
            if (
              cellStr.includes(",") ||
              cellStr.includes('"') ||
              cellStr.includes("\n")
            ) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          })
          .join(","),
      ),
    ].join("\n");

    return BOM + csvContent;
  }

  /**
   * Export tree view as image
   * @param {React.RefObject} viewRef - Reference to the view to capture
   * @param {Object} options - Export options
   * @returns {Promise<{success: boolean, uri?: string, error?: string}>}
   */
  async exportTreeAsImage(viewRef, options = {}) {
    try {
      const {
        format = "png",
        quality = 0.9,
        width = 1920,
        height = 1080,
      } = options;

      // Capture the view as image
      const uri = await captureRef(viewRef, {
        format,
        quality,
        width,
        height,
        result: "tmpfile",
      });

      // Move to exports directory
      const fileName = `family_tree_${Date.now()}.${format}`;
      const finalUri = `${this.exportDir}${fileName}`;

      await FileSystem.moveAsync({
        from: uri,
        to: finalUri,
      });

      // Share the image
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(finalUri, {
          mimeType: `image/${format}`,
          dialogTitle: "مشاركة صورة شجرة العائلة",
          UTI: format === "png" ? "public.png" : "public.jpeg",
        });
      }

      return { success: true, uri: finalUri };
    } catch (error) {
      console.error("Image export error:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Export all data in JSON format (existing functionality)
   * @param {Array} profiles - Array of profile objects
   * @returns {Promise<{success: boolean, uri?: string, error?: string}>}
   */
  async exportToJSON(profiles) {
    try {
      const data = {
        exportDate: new Date().toISOString(),
        version: "1.0",
        profileCount: profiles.length,
        profiles: profiles,
      };

      const json = JSON.stringify(data, null, 2);
      const fileName = `family_data_${Date.now()}.json`;
      const fileUri = `${this.exportDir}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Share the JSON
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "application/json",
          dialogTitle: "مشاركة بيانات العائلة",
          UTI: "public.json",
        });
      }

      return { success: true, uri: fileUri };
    } catch (error) {
      console.error("JSON export error:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get list of exported files
   * @returns {Promise<Array>}
   */
  async getExportedFiles() {
    try {
      const files = await FileSystem.readDirectoryAsync(this.exportDir);
      const fileDetails = await Promise.all(
        files.map(async (fileName) => {
          const fileUri = `${this.exportDir}${fileName}`;
          const info = await FileSystem.getInfoAsync(fileUri);
          return {
            name: fileName,
            uri: fileUri,
            size: info.size,
            modificationTime: info.modificationTime,
            type: fileName.split(".").pop().toUpperCase(),
          };
        }),
      );

      // Sort by modification time (newest first)
      return fileDetails.sort(
        (a, b) => b.modificationTime - a.modificationTime,
      );
    } catch (error) {
      console.error("Error getting exported files:", error);
      return [];
    }
  }

  /**
   * Delete an exported file
   * @param {string} fileUri - URI of the file to delete
   * @returns {Promise<boolean>}
   */
  async deleteExportedFile(fileUri) {
    try {
      await FileSystem.deleteAsync(fileUri);
      return true;
    } catch (error) {
      console.error("Error deleting file:", error);
      return false;
    }
  }

  /**
   * Clear all exported files
   * @returns {Promise<boolean>}
   */
  async clearAllExports() {
    try {
      await FileSystem.deleteAsync(this.exportDir, { idempotent: true });
      await this.ensureExportDirectory();
      return true;
    } catch (error) {
      console.error("Error clearing exports:", error);
      return false;
    }
  }
}

export default new ExportService();
