#!/bin/bash

# curl should fail the pipe
set -o pipefail

OUTPUT_DIR="vendor/"
if [ ! -d "${OUTPUT_DIR}" ]; then
  mkdir ${OUTPUT_DIR}
fi

URL="http://dl.google.com/closure-compiler/compiler-latest.tar.gz"

TMP_FILE="compiler.tar.gz"

if ! curl "${URL}" > "${TMP_FILE}"; then
  echo "Failed to retrieve jar from ${EXPECTED_URL}..."
  rm "${TMP_FILE}"
  exit 1
fi

mkdir -p tmp

if ! tar -C tmp -xvzf "${TMP_FILE}"; then
  echo "Failed to extract the compiler.jar file from ${TMP_FILE}..."
  exit 1
fi

rm "${TMP_FILE}"
mv "tmp/compiler.jar" "${OUTPUT_DIR}"
rm -rf tmp/
