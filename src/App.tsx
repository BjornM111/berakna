import React, {useState, useEffect} from 'react';
import './App.css';
import {parse, ParseResult} from 'papaparse';
import {DateTime, Duration} from 'luxon';

const isData = (data: any): data is string[][] => true;

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function stringToColor(string: string) {
  let hash = 0;
  for (let i=0; i<string.length; i++) {
    hash = ((hash<<5)+hash)+string.charCodeAt(i);
  }
  return `hsl(${hash}, 50%, 50%)`;
}

function Table(props: {
  rows: [DateTime, string, number][],
  onClick: (value: string) => void,
  title: React.ReactNode,
  disabled?: (value: string) => boolean,
}) {
  const rows = [...props.rows].sort((a, b) => {
    if (a[1]<b[1]) return -1;
    if (a[1]>b[1]) return 1;
    return 0;
  })
  return (
    <div className="table">
      {props.title}
      <div className="table-container">
        <div className="grid">
          {rows.map((row, i) =>
            [
              <div 
                key={i+"a"}
                style={{
                  gridRow: i+1,
                  gridColumn: 1,
                  color: props.disabled && props.disabled(row[1])
                    ? "#ccc"
                    : undefined,
                }}
              >
                {row[0].toFormat('dd/MM/yyyy')}
              </div>,
              <div
                key={i+"b"}
                style={{
                  gridRow: i+1,
                  gridColumn: 2,
                  color: props.disabled && props.disabled(row[1])
                    ? "#ccc"
                    : undefined,
                }}
              >
                {row[1].split(' ').map(word =>
                  <span onClick={() => props.onClick(word)} style={{marginRight: 4}}>
                    {word}
                  </span>
                )}
              </div>,
              <div
                key={i+"c"}
                style={{
                  gridRow: i+1,
                  gridColumn: 3,
                  color: props.disabled && props.disabled(row[1])
                    ? "#ccc"
                    : undefined,
                  textAlign: "right",
                }}
              >
                {new Intl.NumberFormat('en').format(row[2])}
              </div>,
            ]
          ).flat()}
        </div>
      </div>
    </div>
  );
}


function Graph2(props: {names: string[], graphs: [DateTime, number][][]}) {
  if (!props.names.length) return null;

  const minDate = DateTime.min(...props.graphs.map(graph => graph[0][0]));
  const maxDate = DateTime.max(...props.graphs.map(graph => graph[graph.length-1][0]));
  const numMonths = Math.ceil(maxDate.diff(minDate, 'months').months);

  const monthlyData: Float32Array[] = [];
  // aggregate the values over months
  for (const graph of props.graphs) {
    const values = new Float32Array(numMonths);
    monthlyData.push(values);
    for (const point of graph) {
      let monthIndex = Math.floor(point[0].diff(minDate, 'months').months);
      values[monthIndex] += point[1];
    }
  }
  
  const minValue = Math.min(...monthlyData.map(graph => [...graph]).flat());
  const maxValue = Math.max(...monthlyData.map(graph => [...graph]).flat());
  const valueDiv = maxValue-minValue;

  return (
    <svg width="500" height="300">
      {/*props.graphs.map((graph, i) =>
        <path
          key={props.names[i]}
          //d={"M "+graph.map(point => `${(point[0].valueOf()-minDate)/dateDiv*500},${300 - (point[1]-minValue)/valueDiv*300}`).join(' L ')}
          stroke={stringToColor(props.names[i])}
          fill="transparent"
        />
      )*/null}
      {monthlyData.map((graph, i) =>
        <path
          key={props.names[i]}
          d={"M "+[...graph].map((value, x) => `${x/numMonths*500},${300 - (value-minValue)/valueDiv*300}`).join(' L ')}
          stroke={stringToColor(props.names[i])}
          fill="transparent"
        />
      )}
    </svg>
  )
}

function Graph(props: {names: string[], graphs: [DateTime, number][][]}) {
  if (!props.names.length) return null;

  const minDate = DateTime.min(...props.graphs.map(graph => graph[0][0]));
  const maxDate = DateTime.max(...props.graphs.map(graph => graph[graph.length-1][0]));
  const numMonths = Math.ceil(maxDate.diff(minDate, 'months').months);

  const monthlyData: Float32Array[] = [];
  // aggregate the values over months
  for (const graph of props.graphs) {
    const values = new Float32Array(numMonths);
    monthlyData.push(values);
    for (const point of graph) {
      let monthIndex = Math.floor(point[0].diff(minDate, 'months').months);
      values[monthIndex] += point[1];
    }
  }
  
  const minValue = -100000
  const maxValue = Math.max(...monthlyData.map(graph => [...graph]).flat());
  //const valueDiv = maxValue-minValue;
  const valueDiv  = minValue*-1;

  const sum = new Float32Array(props.graphs[0].length);

  return (
    <svg width="500" height="300">
      {/*props.graphs.map((graph, i) =>
        <path
          key={props.names[i]}
          //d={"M "+graph.map(point => `${(point[0].valueOf()-minDate)/dateDiv*500},${300 - (point[1]-minValue)/valueDiv*300}`).join(' L ')}
          stroke={stringToColor(props.names[i])}
          fill="transparent"
        />
      )*/null}
      {monthlyData.map((graph, i) =>
        <path
          key={props.names[i]}
          d={"M "
            +[...sum].reverse().map((value, x) => `${(sum.length-1-x)/numMonths*500},${(value-minValue)/valueDiv*300}`).join(' L ')
            +' L '
            +[...graph].map((value, x) => `${x/numMonths*500},${((sum[x]+=value)-minValue)/valueDiv*300}`).join(' L ')
          }
          fill={stringToColor(props.names[i])}
          stroke="transparent"
        />
      )}
    </svg>
  )
}


function App() {
  const [data, setData] = useState<null|[DateTime, string, number][]>(null);
  const [currentSearches, setCurrentSearches] = useState<string[]>([]);
  const [groupings, setGroupings] = useState<{name: string, searches: string[]}[]>([]);
  const [currentName, setCurrentName] = useState<string>("");

  let dataPath: string;
  dataPath = 'nordea-piffopuff';
  dataPath = 'swedbank-bjorn';
  
  useEffect(() => {
    //parse('/Transaktioner_2020-04-10_08-52-52.csv', {
    //parse('/piff_o_puff.csv', {
    parse(`/${dataPath}.csv`, {
      download: true,
      complete(result) {
        let newData = result.data.slice(2, result.data.length-2);
        if (!isData(newData)) return;
        if (newData.length<1) return;
        newData.reverse();

        if (dataPath.startsWith('swedbank')) {
          setData(newData.map(row => [
            DateTime.fromFormat(row[5], 'yyyy-MM-dd'),
            row[9],
            Number(row[10]),
          ]));
        } else {
          setData(newData.map(row => [
            DateTime.fromFormat(row[0], 'yyyy-MM-dd'),
            row[1].includes('Kortköp ')
              ? row[1].split(' ').slice(2).join(' ')
              : row[1],
            Number(row[3].replace('.', '').replace(',', '.')),
          ]));
        }
      }
    })
  }, []);

  useEffect(() => {
    setGroupings(JSON.parse(localStorage.getItem(dataPath)||"[]"))
  }, []);

  const groupingsJson = JSON.stringify(groupings);
  useEffect(() => {
    localStorage.setItem(dataPath, groupingsJson);
  }, [groupingsJson]);

  if (!data) return <div className="App" />;

  // create groups based on "searches"
  const groups: [DateTime, string, number][][] = groupings.map(() => []);
  const regexes = groupings.map(grouping => new RegExp(grouping.searches.join('|')));
  let restData: [DateTime, string, number][] = [];
  loop1: for (const row of data) {
    for (let i=0; i<groupings.length; i++) {
      if (!regexes[i].test(row[1])) continue;
      groups[i].push(row);
      continue loop1;
    }
    restData.push(row);
  }
  
  let currentData = null;
  if (currentSearches.length) {
    try {
      let regex = new RegExp(currentSearches.join('|'));
      currentData = restData.filter(row => regex.test(row[1]));
      restData = restData.filter(row => !regex.test(row[1]));
    } catch (error) {}
  }

  // summaries
  const summaries = groups.map((group, i) =>
    group.reduce(
      (result, [,,value]) => result+value,
      0,
    )
  );
  const minSum = Math.min(...summaries);
  const maxSum = Math.max(...summaries);
  const sumDiv = maxSum-minSum;

  return (
    <div>
      <Graph
        names={groupings.slice(1).map(grouping => grouping.name)}
        graphs={groups.slice(1).map(group => group.map(point => [point[0], point[2]]))}
      />
      <input
        type="text"
        value={currentName}
        onChange={event => setCurrentName(event.target.value)}
      />
      {currentSearches.map((search, i) =>
        <input 
          type="text"
          value={search}
          onChange={event => setCurrentSearches([
            ...currentSearches.slice(0, i),
            ...(event.target.value ? [event.target.value] : []),
            ...currentSearches.slice(i+1),
          ])}
        />
      )}
      <button onClick={() => setCurrentSearches([])}>x</button>
      <button onClick={() => {
        if (!currentName) return;
        setGroupings([...groupings, {name: currentName, searches: currentSearches}]);
        setCurrentSearches([]);
        setCurrentName("");
      }}>+</button>
      <div style={{display: "flex"}}>
        <Table
          rows={restData}
          onClick={value => {
            setCurrentSearches([...currentSearches, escapeRegExp(value)])
            if (!currentName)
              setCurrentName(value.split(" ")[0])
          }}
          title="Unfiltered"
        />
        {currentData
          ? <Table
            rows={currentData}
            onClick={value => {
              setCurrentSearches([...currentSearches, escapeRegExp(value)])
              if (!currentName)
                setCurrentName(value.split(" ")[0])
            }}
            title={currentName}
          />
          : <div className="table"/>
        }
        {/*groups.map((group, i) =>
          <Table 
            rows={group}
            key={i}
            onClick={() => null}
            title={
              <span onClick={() => {
                setCurrentName(groupings[i].name);
                setCurrentSearches([...currentSearches, ...groupings[i].searches])
                setGroupings([
                  ...groupings.slice(0, i),
                  ...groupings.slice(i+1),
                ]);
              }}>{groupings[i].name}</span>}
          />
            )*/null}
        <div>
          {summaries.map((sum, i) =>
            <div style={{display: "flex"}}>
              <div 
                onClick={() => {
                  setCurrentName(groupings[i].name);
                  setCurrentSearches([...currentSearches, ...groupings[i].searches])
                  setGroupings([
                    ...groupings.slice(0, i),
                    ...groupings.slice(i+1),
                  ]);
                }}
                key={i}
                style={{
                  color: stringToColor(groupings[i].name),
                  display: "flex",
                  width: 200,
                }}
              >
                <div style={{flex: 1}}>{groupings[i].name}</div>
                <div style={{textAlign: "right"}}>{new Intl.NumberFormat('en').format(sum/12)}</div>
              </div>
              <div style={{width: 300}}>
                <div
                  style={{
                    background: stringToColor(groupings[i].name),
                    height: 20,
                    width: Math.abs(sum/sumDiv) *300,
                    marginLeft: (minSum/sumDiv *-1 + Math.min(0, sum/sumDiv)) *300,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
