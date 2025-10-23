const handleExportDatabase = async () => {
  Alert.alert(
    "اختر صيغة التصدير",
    "كيف تريد تصدير التقرير؟",
    [
      {
        text: "PDF",
        onPress: async () => {
          try {
            setExporting(true);

            // Import PDF export service
            const pdfExportService =
              require("../services/pdfExportService").default;

            // Fetch recent profiles for the report
            const { data: profiles } = await supabase
              .from("profiles")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(20);

            // Generate and share PDF
            await pdfExportService.exportAdminStatsPDF(stats, profiles || []);
          } catch (error) {
            console.error("PDF export error:", error);
            Alert.alert("خطأ", `فشل تصدير PDF: ${  error.message}`);
          } finally {
            setExporting(false);
          }
        },
      },
      {
        text: "نص",
        onPress: async () => {
          try {
            setExporting(true);

            // Fetch all profiles with relationships
            const { data: profiles } = await supabase
              .from("profiles")
              .select(
                `
                  *,
                  marriages:marriages!husband_id(
                    *,
                    wife:wife_id(name),
                    husband:husband_id(name)
                  )
                `,
              )
              .order("generation", { ascending: true })
              .order("sibling_order", { ascending: true });

            if (!profiles || profiles.length === 0) {
              Alert.alert("تنبيه", "لا توجد بيانات للتصدير");
              return;
            }

            // Import the simple export service
            const simpleExportService =
              require("../services/simpleExportService").default;

            // Export as formatted text file
            const result = await simpleExportService.exportAsFormattedText(
              profiles,
              {
                stats,
                title: "تقرير شجرة العائلة",
                timestamp: new Date().toISOString(),
              },
            );

            if (!result.success) {
              throw new Error(result.error || "فشل التصدير");
            }
          } catch (error) {
            console.error("Text export error:", error);
            Alert.alert("خطأ", `فشل تصدير النص: ${  error.message}`);
          } finally {
            setExporting(false);
          }
        },
      },
      {
        text: "إلغاء",
        style: "cancel",
      },
    ],
    { cancelable: true },
  );
};
