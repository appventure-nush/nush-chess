/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                nush: {
                    light: "#76c2ce",
                    mid: "#43919d",
                    dark: "#00636f",
                },
            },
        },
    },
    plugins: [],
};
