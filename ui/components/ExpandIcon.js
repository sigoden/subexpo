import { MinusSquareOutlined, PlusSquareOutlined } from "@ant-design/icons";
export default function ExpandIcon({ expanded, onExpand, record }) {
  const styles = { color: "#ccbfbf", fontSize: "1.2rem" };
  return expanded ? (
    <MinusSquareOutlined style={styles} onClick={(e) => onExpand(record, e)} />
  ) : (
    <PlusSquareOutlined style={styles} onClick={(e) => onExpand(record, e)} />
  );
}
