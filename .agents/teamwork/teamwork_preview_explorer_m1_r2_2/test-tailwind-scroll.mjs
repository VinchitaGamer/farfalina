import postcss from "postcss";
import tailwindcss from "tailwindcss";

const cssTest = `
@tailwind utilities;
`;

const config = {
  content: [{ raw: '<div class="overflow-x-auto flex items-center gap-1.5 p-3 pb-2.5 touch-pan-x overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0 min-h-[44px]"></div>' }],
  theme: { extend: {} },
};

async function testTailwind() {
  const result = await postcss([tailwindcss(config)]).process(cssTest, { from: undefined });
  console.log("Tailwind compiled classes for scroll utilities:");
  console.log(result.css);
}

testTailwind();
