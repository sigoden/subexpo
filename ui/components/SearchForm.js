import React, { useCallback, useMemo } from "react";
import { Form, Cascader,  DatePicker, Button } from "antd";
import { useRequest } from "@umijs/hooks";
import moment from "moment";
import { camelCase } from "change-case";
import styles from "./SearchForm.module.css";

const { RangePicker } = DatePicker;

function getModules(modules, type) {
  if (!Array.isArray(modules)) return [];
  return modules.filter(mod => Array.isArray(mod[type]) && mod[type].length > 0).map(mod => {
    const modName = camelCase(mod.name);
    const childNames = mod[type]?.map(name => {
      if (type === "calls") {
        return camelCase(name);
      }
      return name;
    });
    return {
      value: modName,
      label: modName,
      children: [
        { value: "", label: type === "calls" ? "all" : "All" },
        ...childNames.map(name => ({ value: name, label: name })),
      ]
    }
  });
}

export default function SearchForm({
  form, submit, reset, kind,
}) {
  const { data } = useRequest(
    { url: "/api/state" }, 
    { cacheKey: "state" }
  );
  const modules = useMemo(() => getModules(data?.modules, kind), [data, kind]);
  const disableDate = useCallback((date) => {
    if (!data?.firstBlockAt) return false;
    return date < moment(data.firstBlockAt * 1000).startOf("day") || date > moment(data.lastBlockAt * 1000).endOf("day")
  }, [data]);
  return (
    <div className={styles.root}>
      <Form
        form={form} 
        layout="inline"
      >
        <Form.Item label="Module" name="module">
          <Cascader options={modules}  style={{width: 250}} />
        </Form.Item>
        <Form.Item label="Date" name="date">
          <RangePicker disabledDate={disableDate} />
        </Form.Item>
        <Form.Item style={{ marginLeft: "auto"}}>
          <Button onClick={submit}>Filter</Button>
        </Form.Item>
        <Form.Item style={{ marginRight: 0 }}>
          <Button onClick={reset}>Reset</Button>
        </Form.Item>
      </Form>
    </div>
  );
}