const React = require("react");
const { StyleSheet, View } = require("react-native");

function colorFrom(colors) {
  if (!Array.isArray(colors) || colors.length === 0) return "transparent";
  return typeof colors[0] === "string" ? colors[0] : "transparent";
}

function LinearGradient({ colors, locations, start, end, style, children, ...props }) {
  return React.createElement(
    View,
    {
      ...props,
      style: [
        { backgroundColor: colorFrom(colors), overflow: "hidden" },
        StyleSheet.flatten(style),
      ],
    },
    children,
  );
}

module.exports = {
  LinearGradient,
};
