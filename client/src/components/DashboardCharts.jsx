import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  Tooltip,
  PieChart,
  Pie,
} from "recharts";

// The two Dashboard charts live in their own file so the (large) charts library is
// downloaded separately and the rest of the Dashboard can appear without waiting for it.

function peso(amount) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function WeekdayChart({ data, todayIndex }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barCategoryGap="28%">
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#94A3B8", fontSize: 11 }}
        />
        <Tooltip
          cursor={{ fill: "rgba(15,23,42,0.04)" }}
          formatter={(value) => [peso(value), "Due"]}
          contentStyle={{
            borderRadius: 12,
            border: "none",
            boxShadow: "0 8px 20px -10px rgba(15,23,42,0.25)",
          }}
        />
        <Bar dataKey="amount" radius={[8, 8, 8, 8]} maxBarSize={36}>
          {data.map((entry, i) => (
            <Cell
              key={entry.label}
              fill={i === todayIndex ? "#1F2937" : "#E4E7EC"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BreakdownChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="62%"
          outerRadius="89%"
          paddingAngle={data.length > 1 ? 3 : 0}
          stroke="none"
        >
          {data.map((slice) => (
            <Cell key={slice.name} fill={slice.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value, name) => [peso(value), name]} />
      </PieChart>
    </ResponsiveContainer>
  );
}
