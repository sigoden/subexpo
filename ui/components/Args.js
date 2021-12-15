import { Row, Col } from "antd";
import dynamic from "next/dynamic";
import Link from "next/link";
import styles from "./Args.module.css";
import Balance from "./Balance";

const LargeBytes = dynamic(() => import("./LargeBytes"), { ssr: false });

export default function Args({ args }) {
  return (
    <div className={styles.table}>
      {args.map((arg, index) => (
        <div key={index} className={styles.item}>
          <div md={4} className={styles.itemName}>
            <div>
              {arg.name || arg.type}
            </div>
          </div>
          <div className={styles.itemValue}>
            <ArgValue type={arg.type} value={arg.value} />
          </div>
        </div>
      ))}
    </div>
  )
}

function ArgValue({ type, value }) {
  if (type === "Call") {
    return (
      <div>
        <Row className={styles.item}>
          <Col md={4} className={styles.itemName}>
            Module
          </Col>
          <Col className={styles.itemValue}>
            {value.section}
          </Col>
        </Row>
        <Row className={styles.item}>
          <Col md={4} className={styles.itemName}>
            Call
          </Col>
          <Col className={styles.itemValue}>
            {value.method}
          </Col>
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
    )
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
    )
  } else if (type === "Balance" || type === "Compact<Balance>" || type === "BalanceOf") {
    return <Balance balance={value} />
  } else if (type === "AccountId" || type === "LookupSource") {
    return <Link href={`/accounts/${value}`}><a>{value}</a></Link>;
  } else if (type === "Bytes" && value.length > 262144) {
    return <LargeBytes bytes={value}/>
  }
  return <div>{value}</div>;
}
