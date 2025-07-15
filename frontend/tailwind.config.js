module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        fadeIn: 'fadeIn 0.4s ease-in-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
// This is a Tailwind CSS configuration file that specifies the content paths
// where Tailwind should look for class names to generate styles. It also extends
// the default theme, allowing for custom styles to be added later. The plugins
// array is currently empty, meaning no additional plugins are being used.