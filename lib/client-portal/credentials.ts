import crypto from "crypto";

const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const lowercase = "abcdefghijkmnopqrstuvwxyz";
const numbers = "23456789";
const symbols = "!@#$%^&*";
const allCharacters = uppercase + lowercase + numbers + symbols;

function pick(source: string) {
  return source[crypto.randomInt(0, source.length)];
}

export function generateClientPortalPassword(length = 14) {
  const required = [
    pick(uppercase),
    pick(lowercase),
    pick(numbers),
    pick(symbols),
  ];
  const remaining = Array.from({ length: Math.max(length - required.length, 0) }, () =>
    pick(allCharacters),
  );

  return [...required, ...remaining]
    .sort(() => crypto.randomInt(0, 3) - 1)
    .join("");
}
