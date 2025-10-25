import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

class PDFExportService {
  /**
   * Generate HTML template for admin statistics PDF
   */
  generateAdminStatsHTML(stats, profiles) {
    const currentDate = new Date().toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          @page {
            margin: 20mm;
          }
          
          body {
            font-family: 'Arial', 'Helvetica', sans-serif;
            direction: rtl;
            background: white;
            color: #1a1a1a;
            line-height: 1.6;
          }
          
          .header {
            text-align: center;
            padding: 30px 0;
            border-bottom: 3px solid #957EB5;
            margin-bottom: 30px;
            background: linear-gradient(135deg, #F5F3F7 0%, #E8E3EF 100%);
          }
          
          .header h1 {
            font-size: 32px;
            color: #957EB5;
            margin-bottom: 10px;
            font-weight: bold;
          }
          
          .header .subtitle {
            font-size: 18px;
            color: #736372;
          }
          
          .header .date {
            font-size: 14px;
            color: #8E8E93;
            margin-top: 10px;
          }
          
          .section {
            margin-bottom: 40px;
            page-break-inside: avoid;
          }
          
          .section-title {
            font-size: 24px;
            color: #957EB5;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #E0C4A1;
            font-weight: bold;
          }
          
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 30px;
          }
          
          .stat-card {
            background: #F5F3F7;
            padding: 20px;
            border-radius: 12px;
            border-right: 4px solid #957EB5;
          }
          
          .stat-value {
            font-size: 36px;
            font-weight: bold;
            color: #120309;
            margin-bottom: 5px;
          }
          
          .stat-label {
            font-size: 16px;
            color: #736372;
          }
          
          .table-container {
            margin-top: 20px;
            overflow-x: auto;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          th {
            background: #957EB5;
            color: white;
            padding: 12px;
            text-align: right;
            font-weight: bold;
            font-size: 14px;
          }
          
          td {
            padding: 12px;
            border-bottom: 1px solid #E5E5EA;
            font-size: 14px;
          }
          
          tr:hover {
            background: #F5F3F7;
          }
          
          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
          }
          
          .status-active {
            background: #D4F4DD;
            color: #1B5E3F;
          }
          
          .status-deceased {
            background: #FFE4E1;
            color: #8B0000;
          }
          
          .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #E5E5EA;
            text-align: center;
            color: #8E8E93;
            font-size: 12px;
          }
          
          .gold-accent {
            color: #E0C4A1;
          }
          
          .page-break {
            page-break-before: always;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🌙 تقرير إحصائيات شجرة العائلة</h1>
          <div class="subtitle">عائلة القفاري</div>
          <div class="date">${currentDate}</div>
        </div>
        
        <div class="section">
          <h2 class="section-title">📊 الإحصائيات العامة</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${stats.total_profiles || 0}</div>
              <div class="stat-label">إجمالي الأفراد</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.active_members || 0}</div>
              <div class="stat-label">الأحياء</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.male_count || 0}</div>
              <div class="stat-label">الذكور</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.female_count || 0}</div>
              <div class="stat-label">الإناث</div>
            </div>
          </div>
        </div>
        
        <div class="section">
          <h2 class="section-title">📈 إحصائيات إضافية</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${stats.marriages_count || 0}</div>
              <div class="stat-label">عدد حالات الزواج</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.photos_count || 0}</div>
              <div class="stat-label">الصور المرفوعة</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.total_generations || 0}</div>
              <div class="stat-label">عدد الأجيال</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.avg_children_per_family || "0.0"}</div>
              <div class="stat-label">متوسط الأطفال</div>
            </div>
          </div>
        </div>
        
        <div class="section page-break">
          <h2 class="section-title">👥 آخر الأعضاء المضافين</h2>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الجنس</th>
                  <th>الحالة</th>
                  <th>تاريخ الإضافة</th>
                </tr>
              </thead>
              <tbody>
                ${profiles
                  .slice(0, 20)
                  .map(
                    (profile) => `
                  <tr>
                    <td>${profile.name || "غير محدد"}</td>
                    <td>${profile.gender === "male" ? "ذكر" : "أنثى"}</td>
                    <td>
                      <span class="status-badge ${profile.status === "deceased" ? "status-deceased" : "status-active"}">
                        ${profile.status === "deceased" ? "متوفى" : "على قيد الحياة"}
                      </span>
                    </td>
                    <td>${new Date(`${profile.created_at  }Z`).toLocaleDateString("ar-SA")}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="footer">
          <p>تم إنشاء هذا التقرير بواسطة <span class="gold-accent">نظام إدارة شجرة العائلة</span></p>
          <p>جميع الحقوق محفوظة © ${new Date().getFullYear()}</p>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  /**
   * Export admin statistics as PDF
   */
  async exportAdminStatsPDF(stats, profiles) {
    try {
      // Generate HTML
      const html = this.generateAdminStatsHTML(stats, profiles);

      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split("T")[0];
      const fileName = `admin_report_${timestamp}.pdf`;

      // Move file to a permanent location
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.moveAsync({
        from: uri,
        to: fileUri,
      });

      // Share the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "application/pdf",
          dialogTitle: "مشاركة تقرير الإحصائيات",
          UTI: "com.adobe.pdf",
        });
      }

      return { success: true, uri: fileUri };
    } catch (error) {
      console.error("Error generating PDF:", error);
      throw error;
    }
  }

  /**
   * Export individual profile as PDF
   */
  async exportProfilePDF(profile) {
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            direction: rtl;
            padding: 20px;
            line-height: 1.8;
          }
          .header {
            text-align: center;
            padding: 20px;
            background: #957EB5;
            color: white;
            border-radius: 8px;
            margin-bottom: 20px;
          }
          .field {
            margin: 15px 0;
            padding: 10px;
            background: #F5F3F7;
            border-radius: 4px;
          }
          .label {
            font-weight: bold;
            color: #736372;
            margin-left: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${profile.name}</h1>
        </div>
        <div class="field">
          <span class="label">الجنس:</span>
          ${profile.gender === "male" ? "ذكر" : "أنثى"}
        </div>
        <div class="field">
          <span class="label">الحالة:</span>
          ${profile.status === "deceased" ? "متوفى" : "على قيد الحياة"}
        </div>
        ${
          profile.birth_place
            ? `
          <div class="field">
            <span class="label">مكان الميلاد:</span>
            ${profile.birth_place}
          </div>
        `
            : ""
        }
        ${
          profile.current_residence
            ? `
          <div class="field">
            <span class="label">مكان الإقامة:</span>
            ${profile.current_residence}
          </div>
        `
            : ""
        }
        ${
          profile.phone
            ? `
          <div class="field">
            <span class="label">رقم الهاتف:</span>
            ${profile.phone}
          </div>
        `
            : ""
        }
      </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `ملف ${profile.name}`,
        });
      }

      return { success: true, uri };
    } catch (error) {
      console.error("Error exporting profile PDF:", error);
      throw error;
    }
  }
}

export default new PDFExportService();
