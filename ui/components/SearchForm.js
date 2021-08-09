import React, { useCallback, useEffect, useMemo } from "react";
import { Form, Cascader, Input, Grid,  DatePicker, Button } from "antd";
import { useRequest } from "@umijs/hooks";
import { useRouter } from "next/router";
import moment from "moment";
import camelCase from "camelcase";
import styles from "./SearchForm.module.css";

const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

function getModules(modules, type) {
  if (!Array.isArray(modules)) return [];
  let moduleKeys = modules.filter(mod => Array.isArray(mod[type]) && mod[type].length > 0).map(mod => mod.name);
  moduleKeys.sort();
  return moduleKeys.map(modName => {
    const mod = modules.find(mod => mod.name === modName);
    modName = camelCase(modName);
    let childNames = mod[type]?.map(name => {
      if (type === "calls") {
        return camelCase(name);
      }
      return name;
    });
    childNames.sort();
    return {
      value: modName,
      label: modName,
      children: [
        { value: "", label: "*" },
        ...childNames.map(name => ({ value: name, label: name })),
      ]
    }
  });
}

export default function SearchForm({ kind }) {
  const [form] = Form.useForm();
  const screens = useBreakpoint();
  const { data } = useRequest(
    { url: "/api/state" }, 
    { cacheKey: "state" }
  );
  const router = useRouter();
  const modules = useMemo(() => getModules(data?.modules, kind), [data, kind]);
  const disableDate = useCallback((date) => {
    if (!data?.firstBlockAt) return false;
    return date < moment(data.firstBlockAt * 1000).startOf("day") || date > moment().endOf("day")
  }, [data]);
  const handle = useCallback(formData => {
    let qs = "";
    qs = stringifyQueryForm(qs, formData)
    const url = router.pathname + (qs ? "?" + qs : "");
    router.push(url);
  }, [router]);

  useEffect(() => {
    form.setFieldsValue(parseQueryForm(router.query));
  }, [router]);

  const submit = useCallback(() => {
    handle(form.getFieldsValue());
  }, [handle, form]);

  const reset = useCallback(() => {
    form.resetFields();
    handle({});
  }, [handle, form]);

  return (
    <div className={styles.root}>
      <Form
        form={form}
        layout={screens.xs ? "vertical" : "inline"}
      >
        <Form.Item label="Module" name="module">
          <Cascader options={modules}  style={{width: "100%"}} />
        </Form.Item>
        <Form.Item label="Date" name="date">
          <RangePicker disabledDate={disableDate} style={{width: "100%"}} />
        </Form.Item>
        <Form.Item label="Account" name="accountId">
          <Input />
        </Form.Item>
        <Form.Item style={{ marginLeft: "auto"}}>
          <Button onClick={submit}>Filter</Button>
          <Button style={{marginLeft: "0.25rem"}} onClick={reset}>Reset</Button>
        </Form.Item>
      </Form>
    </div>
  );
}

export function parseQueryForm(query) {
  const result = { module: [], date: [] };
  if (query.section) {
    result.module.push(query.section);
    if (query.method) {
      result.module.push(query.method);
    }
  }
  if (query.startDate && query.endDate) {
    const startDate = parseInt(query.startDate);
    const endDate = parseInt(query.endDate);
    if (startDate && endDate) {
      result.date = [moment(startDate * 1000), moment(endDate * 1000)];
    }
  }
  if (query.accountId) {
    result.accountId = query.accountId;
  }
  return result;
}

export function stringifyQueryForm(qs, queryForm) {
  if (queryForm.module?.length) {
    qs += `&section=${queryForm.module[0]}`;
    if (queryForm.module[1]) {
      qs += `&method=${queryForm.module[1]}`;
    }
  }
  if (queryForm.date?.length) {
    qs += `&startDate=${Math.floor(queryForm.date[0].toDate().getTime() / 1000)}`;
    qs += `&endDate=${Math.ceil(queryForm.date[1].toDate().getTime() / 1000)}`;
  }
  if (queryForm.accountId) {
    qs += `&accountId=${queryForm.accountId}`;
  }
  return qs;
}