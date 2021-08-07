import {CopyToClipboard} from "react-copy-to-clipboard";
import { message } from 'antd';

import { CopyOutlined } from "@ant-design/icons";

export default function CopyClipboard({ text }) {
  return (
    <CopyToClipboard text={text} onCopy={() => message.success("Copy Successed")}>
      <CopyOutlined />
    </CopyToClipboard>
  )
}