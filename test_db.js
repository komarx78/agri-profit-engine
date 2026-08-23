const url = "https://xqneyssirhwedoemfzph.supabase.co/rest/v1/m_pesticide_usages?crop_name=ilike.*トマト*&select=crop_name,target_pest&limit=5";
const key = "sb_publishable_HMNRsXUrpQBURJLEm0kfxA_kArWjOCU";

fetch(url, {
  headers: {
    "apikey": key,
    "Authorization": `Bearer ${key}`
  }
})
.then(res => res.json())
.then(data => console.log("Result:", JSON.stringify(data, null, 2)))
.catch(err => console.error("Error:", err));
