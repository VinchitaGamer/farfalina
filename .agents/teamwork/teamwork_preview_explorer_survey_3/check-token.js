const token = "IGAAQEc31zGvVBZAGJGbkN3YTBsdXh5YlNWSkhXVkdBNE1QVjVpRDhIUGRyYjZAiaTQ1YU5ldjc2eVk5TGlyVG1oMkI3ZAk1iNU1wU1FyUDhRQUs2NWp3UXh3bk1HN2d3SVRfa3drYWozeGFNb2NTbDZAtUnI2aUo1dk02ZA2hudmJUZAwZDZD";
const igAccountId = "29643476368611224";

async function checkToken() {
  console.log("Checking token against graph.instagram.com/me...");
  try {
    const res1 = await fetch(`https://graph.instagram.com/v22.0/me?fields=id,username,account_type&access_token=${encodeURIComponent(token)}`);
    const data1 = await res1.json();
    console.log("Response from graph.instagram.com/me:", JSON.stringify(data1, null, 2));
  } catch (err) {
    console.error("Error connecting to graph.instagram.com:", err.message);
  }

  console.log("\nChecking token against graph.facebook.com/me...");
  try {
    const res2 = await fetch(`https://graph.facebook.com/v22.0/me?access_token=${encodeURIComponent(token)}`);
    const data2 = await res2.json();
    console.log("Response from graph.facebook.com/me:", JSON.stringify(data2, null, 2));
  } catch (err) {
    console.error("Error connecting to graph.facebook.com:", err.message);
  }

  console.log("\nChecking account id:", igAccountId);
  try {
    const res3 = await fetch(`https://graph.instagram.com/v22.0/${igAccountId}?fields=id,username&access_token=${encodeURIComponent(token)}`);
    const data3 = await res3.json();
    console.log(`Response for account ${igAccountId}:`, JSON.stringify(data3, null, 2));
  } catch (err) {
    console.error("Error fetching account id:", err.message);
  }
}

checkToken();
