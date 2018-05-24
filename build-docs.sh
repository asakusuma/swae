yarn run build &&
api-extractor run &&
rm -rf docs-output &&
mkdir docs-output &&
api-documenter markdown --input-folder=dist --output-folder=docs-output