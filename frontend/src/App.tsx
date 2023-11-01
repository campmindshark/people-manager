import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';

interface User {
  id: number;
  username: string;
  email: string;
  password: string;
}

interface AppProps {}

interface AppState {
  users: User[];
}

class App extends Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props);
    this.state = {users: []};
  }
  
  componentDidMount() {
    fetch('/users')
      .then(res => res.json())
      .then(users => this.setState({ users }));
  }
  render() {
    return (
      <div className="App">
        <h1>Users</h1>
        {this.state.users.map(user =>
          <div key={user.id}>{user.username}</div>
        )}
      </div>
    );
  }
}
export default App;
