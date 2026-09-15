/* =====================================================================
 *  ใส่ค่าจาก Supabase 2 ค่าตรงนี้ แล้วบันทึกไฟล์ — จบ
 *
 *  หาค่าได้ที่:  Supabase Dashboard -> Project Settings -> API Keys
 *    SUPABASE_URL      = Project URL          เช่น https://abcdefgh.supabase.co
 *    SUPABASE_ANON_KEY = anon / public key    (สตริงยาวมาก)
 *
 *  anon key เปิดเผยต่อสาธารณะได้โดยการออกแบบ ไม่ใช่ความลับ
 *  สิ่งที่ปกป้องข้อมูลจริงๆ คือ Row Level Security ในไฟล์ supabase-setup.sql
 *  ห้ามนำ service_role key มาใส่ตรงนี้เด็ดขาด — อันนั้นคือกุญแจผ่านทุกด่าน
 * ===================================================================== */

window.SUPABASE_URL      = 'PASTE_YOUR_PROJECT_URL_HERE';
window.SUPABASE_ANON_KEY = 'PASTE_YOUR_ANON_KEY_HERE';
