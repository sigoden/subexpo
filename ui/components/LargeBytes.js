export default function LargeBytes({ bytes }) {
  if (bytes.startsWith("0x")) {
    bytes = bytes.slice(2);
  }
  const byteArray = new Uint8Array(bytes.length / 2);
  for (var x = 0; x < byteArray.length; x++) {
    byteArray[x] = parseInt(bytes.substr(x * 2, 2), 16);
  }
  const blob = new Blob([byteArray], { type: "application/octet-stream" });
  const name = bytes.slice(0, 64);
  return (
    <span>
      <a download={name} href={URL.createObjectURL(blob)}>
        {name}
      </a>
      ......{bytes.length - name.length} bytes
    </span>
  );
}
