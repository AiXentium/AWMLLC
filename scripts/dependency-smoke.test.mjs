import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import nodemailer from "nodemailer";

test("patched Excel UUID dependency preserves XLSX export and import", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Takeoff");
  sheet.addRows([
    ["Window", "Quantity"],
    ["StyleGuard", 3],
    ["StyleView", 5],
  ]);
  // Extended data bars exercise ExcelJS's UUID v4 import.
  sheet.addConditionalFormatting({
    ref: "B2:B3",
    rules: [
      {
        type: "dataBar",
        gradient: false,
        cfvo: [{ type: "min" }, { type: "max" }],
        color: { argb: "FF003366" },
      },
    ],
  });
  const data = await workbook.xlsx.writeBuffer();
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(data);
  assert.equal(restored.getWorksheet("Takeoff").getCell("B2").value, 3);
  assert.equal(restored.getWorksheet("Takeoff").getCell("A3").value, "StyleView");
});

test("updated Nodemailer composes notifications without a network transport", async () => {
  const transport = nodemailer.createTransport({ jsonTransport: true });
  const result = await transport.sendMail({
    from: "sender@example.com",
    to: "recipient@example.com",
    subject: "Quote request",
    html: "<p>Project received</p>",
  });
  const message = JSON.parse(result.message);
  assert.equal(message.subject, "Quote request");
  assert.equal(message.html, "<p>Project received</p>");
  transport.close();
});
