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

window.SUPABASE_URL      = 'https://qhlartlijebqczkiqfrw.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_wNIITG8fDyJtcB4WTfKf2A_-Am538O5';
