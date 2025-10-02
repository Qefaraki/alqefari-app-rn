import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

/**
 * Simple Export Service - Creates formatted text reports
 */
class SimpleExportService {
  /**
   * Export profiles as a formatted text report
   */
  async exportAsFormattedText(profiles, options = {}) {
    try {
      const {
        title = "شجرة عائلة القفاري",
        includeMarriages = true,
        includeDates = true,
        includeContact = false,
      } = options;

      // Group profiles by generation
      const generations = {};
      profiles.forEach((profile) => {
        const gen = profile.generation || 0;
        if (!generations[gen]) generations[gen] = [];
        generations[gen].push(profile);
      });

      // Sort each generation by sibling order
      Object.keys(generations).forEach((gen) => {
        generations[gen].sort(
          (a, b) => (a.sibling_order || 0) - (b.sibling_order || 0),
        );
      });

      // Create formatted text report
      let report = "";
      report += "╔" + "═".repeat(50) + "╗\n";
      report += "║" + this.centerText(title, 50) + "║\n";
      report += "╠" + "═".repeat(50) + "╣\n";
      report +=
        "║ " +
        `تاريخ التصدير: ${new Date().toLocaleDateString("ar-SA")}`.padEnd(49) +
        "║\n";
      report += "║ " + `عدد الأفراد: ${profiles.length}`.padEnd(49) + "║\n";
      report += "╚" + "═".repeat(50) + "╝\n\n";

      // Add each generation
      const sortedGenerations = Object.keys(generations).sort(
        (a, b) => parseInt(a) - parseInt(b),
      );

      for (const gen of sortedGenerations) {
        report += "\n";
        report += "┌" + "─".repeat(40) + "┐\n";
        report +=
          "│ " +
          this.centerText(`الجيل ${this.toArabicNumber(gen)}`, 38) +
          " │\n";
        report += "└" + "─".repeat(40) + "┘\n\n";

        for (const person of generations[gen]) {
          report += this.formatPerson(person, {
            includeDates,
            includeContact,
            includeMarriages,
          });
          report += "─".repeat(30) + "\n\n";
        }
      }

      // Add footer
      report += "\n" + "═".repeat(50) + "\n";
      report += "تم إنشاء هذا التقرير من تطبيق شجرة عائلة القفاري\n";
      report += `جميع الحقوق محفوظة © ${new Date().getFullYear()}\n`;

      // Save to file
      const fileName = `family_tree_${Date.now()}.txt`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, report, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/plain;charset=utf-8",
          dialogTitle: "تصدير شجرة العائلة",
          UTI: "public.plain-text",
        });
      }

      return { success: true, uri: fileUri };
    } catch (error) {
      console.error("Export error:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Format a single person's information
   */
  formatPerson(person, options) {
    let text = "";

    // Name and ID
    text += `👤 الاسم: ${person.name || "غير محدد"}\n`;
    if (person.hid) {
      text += `   المعرف: ${person.hid}\n`;
    }

    // Gender
    if (person.gender) {
      text += `   الجنس: ${person.gender === "male" ? "👨 ذكر" : "👩 أنثى"}\n`;
    }

    // Dates
    if (options.includeDates) {
      if (person.birth_year_hijri) {
        text += `   📅 سنة الميلاد: ${this.toArabicNumber(person.birth_year_hijri)} هـ\n`;
      }
      if (person.death_year_hijri) {
        text += `   ⚰️ سنة الوفاة: ${this.toArabicNumber(person.death_year_hijri)} هـ\n`;
      }
    }

    // Location and occupation
    if (person.current_residence) {
      text += `   📍 مكان الإقامة: ${person.current_residence}\n`;
    }
    if (person.occupation) {
      text += `   💼 المهنة: ${person.occupation}\n`;
    }

    // Contact info
    if (options.includeContact) {
      if (person.phone) {
        text += `   📱 الهاتف: ${person.phone}\n`;
      }
      if (person.email) {
        text += `   📧 البريد: ${person.email}\n`;
      }
    }

    // Bio
    if (person.bio) {
      text += `   📝 نبذة: ${person.bio.substring(0, 100)}${person.bio.length > 100 ? "..." : ""}\n`;
    }

    // Marriages
    if (
      options.includeMarriages &&
      person.marriages &&
      person.marriages.length > 0
    ) {
      text += `   💑 حالات الزواج: ${person.marriages.length}\n`;
      person.marriages.forEach((m) => {
        const spouseName = m.wife?.name || m.husband?.name || "غير محدد";
        text += `      - ${spouseName} (${m.status === "married" ? "متزوج" : m.status})\n`;
      });
    }

    return text;
  }

  /**
   * Convert number to Arabic numerals
   */
  toArabicNumber(num) {
    if (!num) return "";
    const arabicNumbers = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
    return num.toString().replace(/\d/g, (digit) => arabicNumbers[digit]);
  }

  /**
   * Center text within a given width
   */
  centerText(text, width) {
    const len = text.length;
    const padding = Math.floor((width - len) / 2);
    return (
      " ".repeat(Math.max(0, padding)) +
      text +
      " ".repeat(Math.max(0, width - len - padding))
    );
  }
}

export default new SimpleExportService();
