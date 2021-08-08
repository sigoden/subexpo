import { Row, Col  } from "antd";

import styles from "./Args.module.css";

export default function Args({ args }) {
  return (
    <div className={styles.container}>
      <div className={styles.table}>
        {args.map((arg, index) => (
          <Row key={index} className={styles.item}>
            <Col md={4} className={styles.itemName}>
              <div>
                {arg.name || arg.type}
              </div>
            </Col>
            <Col className={styles.itemValue}>
              <ArgValue type={arg.type} value={arg.value} />
            </Col>
          </Row>
        ))}
      </div>
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
  }
return <div>{value}</div>;
}