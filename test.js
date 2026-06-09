import figlet from "figlet";

const getOpts = async () => {
  const fonts = figlet.fontsSync();

  for (let font of fonts) {
    console.log(`Testing ${font}`);
    console.log(
      await figlet.text(`The quick fox jumped over the lazy dog.`, {
        font: font,
      }),
    );
    console.log(
      await figlet.text(`1 2 3 4 5 6 7 8 9 0`, {
        font: font,
      }),
    );

    console.log(
      await figlet.text("~ ` ! @ # $ % ^ & * ( ) - _ + =", {
        font: font,
      }),
    );
    console.log(
      await figlet.text("< > / ? ; : { } \ | [ ] , .", {
        font: font,
      }),
    );
    console.log("--------------------------------------------------");
  }
};

getOpts();
