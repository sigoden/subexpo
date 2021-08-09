import { Col, Row } from "antd";

import styles from "./BlockInfo.module.css";
import Balance from "./Balance";

const items  = [
  {
    title: "Free",
    render: account => <Balance balance={account.free} />
  },
  {
    title: "Reserved",
    render: account => <Balance balance={account.reserved} />
  },
  {
    title: "Nonce",
    render: account => account.nonce,
  },
];

export default function BlockInfo({ account }) {
  return (
    <div className={styles.container}>
      {items.map(({title, render}) => (
        <Row className={styles.item} key={title}>
          <Col className={styles.itemLabel} md={4}>{title}</Col>
          <Col className={styles.itemValue}>
            {render(account)}
          </Col>
        </Row>
      ))}
    </div>
  )
}