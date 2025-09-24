import { Platform, Alert } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { supabase } from "./supabase";
import { toArabicNumerals } from "../utils/dateUtils";

// Try to import native module, fallback to null if not available
let RNHTMLtoPDF = null;
try {
  RNHTMLtoPDF = require("react-native-html-to-pdf").default;
} catch (e) {
  console.log("react-native-html-to-pdf not available, using expo-print fallback");
}

class PDFExportService {
  /**
   * Generate HTML for the family tree PDF
   */
  generateFamilyTreeHTML(profiles, options = {}) {
    const {
      title = "شجرة عائلة القفاري",
      includePhotos = true,
      includeMarriages = true,
      includeMunasib = true,
    } = options;

    // Group profiles by generation
    const profilesByGeneration = {};
    profiles.forEach((profile) => {
      const gen = profile.generation || 0;
      if (!profilesByGeneration[gen]) {
        profilesByGeneration[gen] = [];
      }
      profilesByGeneration[gen].push(profile);
    });

    // Arabic generation names
    const generationNames = [
      "الجيل الأول",
      "الجيل الثاني",
      "الجيل الثالث",
      "الجيل الرابع",
      "الجيل الخامس",
      "الجيل السادس",
      "الجيل السابع",
      "الجيل الثامن",
      "الجيل التاسع",
      "الجيل العاشر",
    ];

    const getGenerationName = (gen) => {
      return generationNames[gen - 1] || `الجيل ${toArabicNumerals(gen)}`;
    };

    // Generate HTML with RTL support
    let html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&display=swap');

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Noto Naskh Arabic', 'Arial', serif;
            direction: rtl;
            background: #F9F7F3;
            color: #242121;
            line-height: 1.8;
            padding: 20px;
          }

          .header {
            text-align: center;
            padding: 40px 20px;
            background: linear-gradient(135deg, #A13333 0%, #D58C4A 100%);
            color: #F9F7F3;
            border-radius: 12px;
            margin-bottom: 30px;
            page-break-after: avoid;
          }

          .header h1 {
            font-size: 36px;
            font-weight: 700;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
          }

          .header .date {
            font-size: 14px;
            opacity: 0.9;
          }

          .header .stats {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin-top: 20px;
            flex-wrap: wrap;
          }

          .header .stat {
            text-align: center;
          }

          .header .stat-number {
            font-size: 24px;
            font-weight: 700;
            display: block;
          }

          .header .stat-label {
            font-size: 12px;
            opacity: 0.9;
          }

          .generation-section {
            margin: 30px 0;
            page-break-inside: avoid;
          }

          .generation-header {
            background: #D1BBA3;
            padding: 12px 20px;
            border-radius: 8px 8px 0 0;
            margin-bottom: 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .generation-title {
            font-size: 20px;
            font-weight: 600;
            color: #242121;
          }

          .generation-count {
            background: #A13333;
            color: #F9F7F3;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
          }

          .profiles-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 15px;
            padding: 15px;
            background: #F9F7F3;
            border: 1px solid #D1BBA340;
            border-radius: 0 0 8px 8px;
          }

          .profile-card {
            background: white;
            border: 1px solid #D1BBA340;
            border-radius: 8px;
            padding: 15px;
            page-break-inside: avoid;
            transition: all 0.3s ease;
          }

          .profile-card.munasib {
            border-right: 4px solid #957EB5;
            background: #957EB508;
          }

          .profile-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
          }

          .profile-photo {
            width: 50px;
            height: 50px;
            border-radius: 25px;
            object-fit: cover;
            border: 2px solid #D1BBA3;
          }

          .profile-photo-placeholder {
            width: 50px;
            height: 50px;
            border-radius: 25px;
            background: linear-gradient(135deg, #A13333, #D58C4A);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #F9F7F3;
            font-size: 20px;
            font-weight: 700;
          }

          .profile-name {
            font-size: 16px;
            font-weight: 600;
            color: #242121;
            flex: 1;
          }

          .profile-hid {
            font-size: 12px;
            color: #736372;
            background: #F9F7F3;
            padding: 2px 8px;
            border-radius: 4px;
            font-family: monospace;
          }

          .profile-details {
            font-size: 13px;
            color: #242121CC;
            line-height: 1.6;
          }

          .profile-detail {
            margin: 4px 0;
            padding-right: 20px;
          }

          .profile-detail strong {
            color: #242121;
            font-weight: 600;
          }

          .munasib-badge {
            display: inline-block;
            background: #957EB5;
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            margin-right: 8px;
          }

          .footer {
            text-align: center;
            margin-top: 50px;
            padding: 20px;
            border-top: 2px solid #D1BBA340;
            font-size: 12px;
            color: #736372;
          }

          @media print {
            .generation-section {
              page-break-inside: avoid;
            }
            .profile-card {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
    `;

    // Header with statistics
    const totalProfiles = profiles.length;
    const maleCount = profiles.filter((p) => p.gender === "male").length;
    const femaleCount = profiles.filter((p) => p.gender === "female").length;
    const munasibCount = profiles.filter((p) => !p.hid).length;
    const withPhotos = profiles.filter((p) => p.photo_url).length;
    const currentDate = new Date().toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    html += `
      <div class="header">
        <h1>${title}</h1>
        <div class="date">تاريخ التصدير: ${currentDate}</div>
        <div class="stats">
          <div class="stat">
            <span class="stat-number">${toArabicNumerals(totalProfiles)}</span>
            <span class="stat-label">إجمالي الأفراد</span>
          </div>
          <div class="stat">
            <span class="stat-number">${toArabicNumerals(maleCount)}</span>
            <span class="stat-label">ذكور</span>
          </div>
          <div class="stat">
            <span class="stat-number">${toArabicNumerals(femaleCount)}</span>
            <span class="stat-label">إناث</span>
          </div>
          ${
            includeMunasib
              ? `
          <div class="stat">
            <span class="stat-number">${toArabicNumerals(munasibCount)}</span>
            <span class="stat-label">منتسبين</span>
          </div>
          `
              : ""
          }
        </div>
      </div>
    `;

    // Generate sections for each generation
    const generations = Object.keys(profilesByGeneration).sort((a, b) => a - b);

    generations.forEach((gen) => {
      const genProfiles = profilesByGeneration[gen];
      const genName = getGenerationName(parseInt(gen));

      html += `
        <div class="generation-section">
          <div class="generation-header">
            <span class="generation-title">${genName}</span>
            <span class="generation-count">${toArabicNumerals(genProfiles.length)}</span>
          </div>
          <div class="profiles-grid">
      `;

      // Sort profiles by name
      genProfiles.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));

      genProfiles.forEach((profile) => {
        const isMunasib = !profile.hid;
        const initials = profile.name ? profile.name.charAt(0) : "؟";

        html += `
          <div class="profile-card ${isMunasib ? "munasib" : ""}">
            <div class="profile-header">
        `;

        // Profile photo or placeholder
        if (includePhotos && profile.photo_url) {
          html += `<img src="${profile.photo_url}" class="profile-photo" alt="${profile.name}" />`;
        } else {
          html += `
            <div class="profile-photo-placeholder">
              ${initials}
            </div>
          `;
        }

        html += `
              <div class="profile-name">
                ${profile.name || "غير معروف"}
                ${isMunasib ? '<span class="munasib-badge">منتسب</span>' : ""}
              </div>
              ${profile.hid ? `<div class="profile-hid">${profile.hid}</div>` : ""}
            </div>
            <div class="profile-details">
        `;

        // Add profile details
        if (profile.birth_year) {
          html += `
            <div class="profile-detail">
              <strong>سنة الميلاد:</strong> ${toArabicNumerals(profile.birth_year)}
            </div>
          `;
        }

        if (profile.death_year) {
          html += `
            <div class="profile-detail">
              <strong>سنة الوفاة:</strong> ${toArabicNumerals(profile.death_year)}
            </div>
          `;
        }

        if (profile.location) {
          html += `
            <div class="profile-detail">
              <strong>المكان:</strong> ${profile.location}
            </div>
          `;
        }

        if (profile.phone) {
          html += `
            <div class="profile-detail">
              <strong>الهاتف:</strong> ${profile.phone}
            </div>
          `;
        }

        html += `
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    // Footer
    html += `
      <div class="footer">
        <p>تم إنشاء هذا التقرير بواسطة تطبيق شجرة عائلة القفاري</p>
        <p>جميع الحقوق محفوظة © ${new Date().getFullYear()}</p>
      </div>
    </body>
    </html>
    `;

    return html;
  }

  /**
   * Export family tree to PDF
   */
  async exportFamilyTreePDF(options = {}) {
    try {
      // Fetch all profiles
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("generation", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;

      if (!profiles || profiles.length === 0) {
        Alert.alert("تنبيه", "لا توجد بيانات للتصدير");
        return null;
      }

      // Generate HTML
      const html = this.generateFamilyTreeHTML(profiles, options);

      // Try native PDF generation first, fallback to Expo Print
      let pdfUri = null;

      if (RNHTMLtoPDF) {
        // Use native module if available
        try {
          const pdfOptions = {
            html,
            fileName: `AlqefariTree_${Date.now()}`,
            directory: Platform.OS === "ios" ? "Documents" : "Download",
            base64: false,
            height: 842, // A4 height in points
            width: 595, // A4 width in points
            padding: 24,
            bgColor: "#F9F7F3",
            ...options.pdfOptions,
          };

          const pdf = await RNHTMLtoPDF.convert(pdfOptions);
          if (pdf.filePath) {
            pdfUri = pdf.filePath;
          }
        } catch (error) {
          console.log("Native PDF generation failed, using Expo Print fallback", error);
        }
      }

      // Fallback to Expo Print
      if (!pdfUri) {
        const { uri } = await Print.printToFileAsync({
          html,
          base64: false,
        });

        // Save to a more permanent location
        const fileName = `AlqefariTree_${Date.now()}.pdf`;
        const newUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.moveAsync({
          from: uri,
          to: newUri,
        });
        pdfUri = newUri;
      }

      if (pdfUri) {
        // Share the PDF
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(pdfUri, {
            mimeType: "application/pdf",
            dialogTitle: "شارك شجرة العائلة",
            UTI: "com.adobe.pdf",
          });
        }
        return pdfUri;
      }

      throw new Error("Failed to generate PDF");
    } catch (error) {
      console.error("PDF Export Error:", error);
      Alert.alert("خطأ", "فشل تصدير ملف PDF. حاول مرة أخرى.");
      throw error;
    }
  }

  /**
   * Export individual profile to PDF
   */
  async exportProfilePDF(profileId, options = {}) {
    try {
      // Fetch profile with relationships
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profileId)
        .single();

      if (error) throw error;

      if (!profile) {
        Alert.alert("خطأ", "لم يتم العثور على الملف الشخصي");
        return null;
      }

      // Create a single profile PDF
      const html = this.generateFamilyTreeHTML([profile], {
        ...options,
        title: `ملف ${profile.name}`,
      });

      let pdfUri = null;

      if (RNHTMLtoPDF) {
        try {
          const pdfOptions = {
            html,
            fileName: `Profile_${profile.name}_${Date.now()}`,
            directory: Platform.OS === "ios" ? "Documents" : "Download",
            base64: false,
            height: 842,
            width: 595,
            padding: 24,
            bgColor: "#F9F7F3",
          };

          const pdf = await RNHTMLtoPDF.convert(pdfOptions);
          if (pdf.filePath) {
            pdfUri = pdf.filePath;
          }
        } catch (error) {
          console.log("Native PDF generation failed, using Expo Print fallback", error);
        }
      }

      // Fallback to Expo Print
      if (!pdfUri) {
        const { uri } = await Print.printToFileAsync({
          html,
          base64: false,
        });

        const fileName = `Profile_${profile.name}_${Date.now()}.pdf`;
        const newUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.moveAsync({
          from: uri,
          to: newUri,
        });
        pdfUri = newUri;
      }

      if (pdfUri) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(pdfUri, {
            mimeType: "application/pdf",
            dialogTitle: `شارك ملف ${profile.name}`,
            UTI: "com.adobe.pdf",
          });
        }
        return pdfUri;
      }

      throw new Error("Failed to generate PDF");
    } catch (error) {
      console.error("Profile PDF Export Error:", error);
      Alert.alert("خطأ", "فشل تصدير الملف الشخصي");
      throw error;
    }
  }

  /**
   * Export Munasib report to PDF
   */
  async exportMunasibReport(options = {}) {
    try {
      // Fetch all Munasib profiles (those without HID)
      const { data: munasibProfiles, error } = await supabase
        .from("profiles")
        .select("*")
        .is("hid", null)
        .order("name");

      if (error) throw error;

      if (!munasibProfiles || munasibProfiles.length === 0) {
        Alert.alert("تنبيه", "لا يوجد منتسبين للتصدير");
        return null;
      }

      // Generate PDF with Munasib focus
      return this.exportFamilyTreePDF({
        ...options,
        title: "تقرير المنتسبين لعائلة القفاري",
        includeMunasib: true,
        customProfiles: munasibProfiles,
      });
    } catch (error) {
      console.error("Munasib Report Export Error:", error);
      Alert.alert("خطأ", "فشل تصدير تقرير المنتسبين");
      throw error;
    }
  }
}

export default new PDFExportService();