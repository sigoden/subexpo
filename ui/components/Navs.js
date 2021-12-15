import { Menu } from "antd";
import Link from "next/link";
import { useRouter } from "next/router";
import styles from "./Navs.module.css";

const navs = [
  ["Blocks", "/blocks"],
  ["Extrinsics", "/extrinsics"],
  ["Events", "/events"],
];

export default function Navs() {
  const router = useRouter();
  return (
    <Menu 
      className={styles.navs}
      theme="dark"
      mode="horizontal"
      selectedKeys={navs.filter(v => router.pathname.startsWith(v[1])).map(v => v[1])}
    >
      {navs.map(([title, href]) => {
          return (
            <Menu.Item key={href}>
              <Link href={href}>{title}</Link>
            </Menu.Item>
          );
      })}
    </Menu>
  );
}