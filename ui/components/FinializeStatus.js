import { CheckCircleOutlined, ClockCircleOutlined } from "@ant-design/icons";

export default function FinalizedStatus({ finalized, text }) {
  return (
    <>
      <span>
        {finalized ? 
          <CheckCircleOutlined style={{color: "rgb(107, 193, 14)"}} /> :
          <ClockCircleOutlined style={{color: "rgb(255 191 46)"}} />
        }
      </span>
      <span style={{marginLeft: "0.5rem"}}>
        {text ? (finalized ? "Finalized" : "Unfinalized" ) : ""}
      </span>
    </>
  );
}