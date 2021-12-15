import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";

export default function ExtrinsicResult({ success, detail }) {
  return (
    <>
      <span>
        {success ? (
          <CheckCircleOutlined style={{ color: "rgb(107, 193, 14)" }} />
        ) : (
          <CloseCircleOutlined style={{ color: "rgb(255, 71, 93)" }} />
        )}
      </span>
      <span style={{ marginLeft: "0.5rem" }}>{detail}</span>
    </>
  );
}
