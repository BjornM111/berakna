import React, {useState, useEffect} from 'react';
import './App.css';
import {parse, ParseResult} from 'papaparse';
import {DateTime} from 'luxon';

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

  return (
    <div className="table">
      {props.title}
      <div className="grid">
        {props.rows.map((row, i) =>
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
              onClick={() => props.onClick(row[1])}
            >
              {row[1]}
            </div>,
            <div
              key={i+"c"}
              style={{
                gridRow: i+1,
                gridColumn: 3,
                color: props.disabled && props.disabled(row[1])
                  ? "#ccc"
                  : undefined,
              }}
            >
              {row[2]}
            </div>,
          ]
        ).flat()}
      </div>
    </div>
  );
}


function Graph(props: {names: string[], graphs: [DateTime, number][][]}) {
  const minDate = DateTime.min(...props.graphs.map(graph => graph[0][0])).valueOf();
  const maxDate = DateTime.max(...props.graphs.map(graph => graph[graph.length-1][0])).valueOf();
  const dateDiv = maxDate-minDate;

  const minValue = Math.min(...props.graphs.map(graph => graph.map(point => point[1])).flat());
  const maxValue = Math.max(...props.graphs.map(graph => graph.map(point => point[1])).flat());
  const valueDiv = maxValue-minValue;

  return (
    <svg width="500" height="300">
      {props.graphs.map((graph, i) =>
        <path
          key={props.names[i]}
          d={"M "+graph.map(point => `${(point[0].valueOf()-minDate)/dateDiv*500},${300 - (point[1]-minValue)/valueDiv*300}`).join(' L ')}
          stroke={stringToColor(props.names[i])}
          fill="transparent"
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
  
  useEffect(() => {
    parse('/Transaktioner_2020-04-10_08-52-52.csv', {
      download: true,
      complete: function(result) {
        let newData = result.data.slice(2, result.data.length-1);
        if (!isData(newData)) return;
        if (newData.length<1) return;
        newData.reverse();
        setData(newData.map(row => [
          DateTime.fromFormat(row[5], 'yyyy-MM-dd'),
          row[9],
          Number(row[10]),
        ]));
      }
    })
  }, []);

  useEffect(() => {
    setGroupings(JSON.parse(localStorage.getItem('groupings')||"[]"))
  }, []);

  const groupingsJson = JSON.stringify(groupings);
  useEffect(() => {
    localStorage.setItem('groupings', groupingsJson);
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

  return (
    <div>
      <Graph
        names={groupings.map(grouping => grouping.name)}
        graphs={groups.map(group => group.map(point => [point[0], point[2]]))}
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
        <div style={{textAlign: "right"}}>
          {groups.map((group, i) =>
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
                color: stringToColor(groupings[i].name)
              }}
            >
              {groupings[i].name}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
