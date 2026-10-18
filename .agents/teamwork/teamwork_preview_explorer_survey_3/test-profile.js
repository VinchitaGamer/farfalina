const token = "IGAAQEc31zGvVBZAGJGbkN3YTBsdXh5YlNWSkhXVkdBNE1QVjVpRDhIUGRyYjZAiaTQ1YU5ldjc2eVk5TGlyVG1oMkI3ZAk1iNU1wU1FyUDhRQUs2NWp3UXh3bk1HN2d3SVRfa3drYWozeGFNb2NTbDZAtUnI2aUo1dk02ZA2hudmJUZAwZDZD";

async function testPermissions() {
  const url = `https://graph.instagram.com/me/permissions?access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log('Permissions:', JSON.stringify(data, null, 2));
}

testPermissions();
