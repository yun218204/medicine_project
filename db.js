const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "", // 沒設密碼就空字串
  database: "medicine_app", // 資料庫名稱
});

connection.connect((err) => {
  if (err) {
    console.error("連線資料庫失敗：", err);
  } else {
    console.log("✅ 成功連接到 MySQL 資料庫！");
  }
});

module.exports = connection; //把 connection匯出讓其他檔案也可以用
