const bcrypt = require("bcryptjs");
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("Escreve a palavra-passe do criador (não será guardada em texto): ", (password) => {
  if (!password || password.length < 12) {
    console.error("Usa uma palavra-passe com pelo menos 12 caracteres.");
    rl.close();
    process.exit(1);
  }
  console.log("\nHash para CREATOR_PASSWORD_HASH:\n" + bcrypt.hashSync(password, 12));
  rl.close();
});