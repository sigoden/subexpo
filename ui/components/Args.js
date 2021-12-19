import { Row, Col } from "antd";
import Link from "next/link";
import { hexToString, hexToU8a } from "@polkadot/util";
import isutf8 from "isutf8";
import styles from "./Args.module.css";
import Balance from "./Balance";

export default function Args({ args }) {
  return (
    <div className={styles.table}>
      {args.map((arg, index) => (
        <div key={index} className={styles.item}>
          <div md={4} className={styles.itemName}>
            <div>{arg.name || arg.type}</div>
          </div>
          <div className={styles.itemValue}>
            <ArgValue type={arg.specialType || arg.type} value={arg.value} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ArgValue({ type, value }) {
  if (type === "Call") {
    return (
      <div>
        <Row className={styles.item}>
          <Col md={4} className={styles.itemName}>
            Module
          </Col>
          <Col className={styles.itemValue}>{value.section}</Col>
        </Row>
        <Row className={styles.item}>
          <Col md={4} className={styles.itemName}>
            Call
          </Col>
          <Col className={styles.itemValue}>{value.method}</Col>
        </Row>
        <Row className={styles.item}>
          <Col md={4} className={styles.itemName}>
            Args
          </Col>
          <Col className={styles.itemValue}>
            <Args args={value.args} />
          </Col>
        </Row>
      </div>
    );
  }
  if (type === "Vec<Call>") {
    return (
      <div>
        {value.map((call, index) => (
          <Row key={index} className={styles.item}>
            <Col md={4} className={styles.itemName}>
              {index}
            </Col>
            <Col className={styles.itemValue}>
              <ArgValue type="Call" value={call} />
            </Col>
          </Row>
        ))}
      </div>
    );
  } else if (type === "Balance") {
    return <Balance balance={value} />;
  } else if (
    type === "AccountId" ||
    ((type === "MultiAddress" || type === "LookupSource") &&
      value.length === 48)
  ) {
    return (
      <Link href={`/accounts/${value}`}>
        <a>{value}</a>
      </Link>
    );
  } else if (type === "BlockNumber") {
    return (
      <Link href={`/blocks/${value}`}>
        <a>{value}</a>
      </Link>
    );
  } else if (type === "LargeBytes") {
    return (
      <Link href={`/api/bytes/${value}`}>
        <a>{value}</a>
      </Link>
    );
  } else if (type === "Bytes" && isutf8(hexToU8a(value))) {
    return <div>{hexToString(value)}</div>;
  }
  return <div>{value}</div>;
}
