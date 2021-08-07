import { Row, Col  } from "antd";

import styles from "./Args.module.css";

export default function Args({ args }) {
  return (
    <div className={styles.container}>
      <div className={styles.table}>
        {args.map((arg, index) => (
          <Row key={index} className={styles.item}>
            <Col md={4} className={styles.itemName}>
              {arg.name || arg.type}
            </Col>
            <Col className={styles.itemValue}>
              {arg.value}
            </Col>
          </Row>
        ))}
      </div>
    </div>
  )
}