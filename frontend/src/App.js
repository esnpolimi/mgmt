import logo from './logo.svg';
import {HashRouter as Router, Routes, Route} from 'react-router-dom';
import './App.css';
import Login from './Pages/Login.js'
import ErasmusForm from './Pages/ErasmusForm.js';
import ESNerForm from './Pages/ESNerForm.js';
import ErasmusProfiles from './Pages/ErasmusProfiles.js';
import ESNersProfiles from './Pages/ESNersProfiles.js';
import Home from './Pages/Home.js'
import Treasury from './Pages/Treasury.js';
import Events from './Pages/Events.js';


function App() {
    return (
        <Router>
            <Routes>
                <Route path='/' element={<Home/>}/>
                <Route path='/erasmus_profiles' element={<ErasmusProfiles/>}/>
                <Route path='/esners_profiles' element={<ESNersProfiles/>}/>
                <Route path='/erasmus_form' element={<ErasmusForm/>}/>
                <Route path='/esner_form' element={<ESNerForm/>}/>
                <Route path='/login' element={<Login/>}/>
                <Route path='/treasury' element={<Treasury/>}/>
                <Route path='/events' element={<Events/>}/>
            </Routes>
        </Router>
    )
}

export default App;
