async function testFreeApi() {
  const text = "キャベツ";
  const targetLanguage = "en";
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(text)}`;
  
  console.log("Fetching:", url);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    console.log("Status:", response.status);
    if (!response.ok) {
      console.error("HTTP error:", response.statusText);
      return;
    }
    const data = await response.json();
    console.log("Data:", JSON.stringify(data));
    if (data && data[0] && data[0][0] && data[0][0][0]) {
      console.log("Translation:", data[0][0][0]);
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

testFreeApi();
