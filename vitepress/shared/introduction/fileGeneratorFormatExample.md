```ts
const generator = new FileGenerator({
  rootDir,
  plugins: [],
  format(files) {
    return files.map(({ content, filePath, plugin }) => ({
      plugin,
      filePath,
      
      // maybe manual
      content: content.trimEnd() + '\n',

      // maybe Biome
      // content: new biome.Workspace().fixFile({ path: filePath, ... })
      
      // maybe Prettier
      // content: prettierSync.format(content, { filepath: filePath })
      
      // maybe ESLint
      // content: new Linter().verifyAndFix(
      //   content, 
      //   [{ rules }], 
      //   { filename: filePath }
      // ).output
    }));
  },
});
```
