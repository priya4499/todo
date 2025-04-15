document.addEventListener('DOMContentLoaded', function() {
    
    const taskInput = document.getElementById('taskInput');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const taskList = document.getElementById('taskList');
    const tasksLeft = document.getElementById('tasksLeft');
    const clearCompletedBtn = document.getElementById('clearCompleted');
    const filterBtns = document.querySelectorAll('.filter-btn');
    
    let currentFilter = 'all';
    let tasks = [];
    
    // Initialize the app
    async function init() {
        await fetchTasks();
        renderTasks();
        updateTasksLeft();
        addEventListeners();
    }
    
    // Add event listeners
    function addEventListeners() {
        addTaskBtn.addEventListener('click', addTask);
        taskInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') addTask();
        });
        
        clearCompletedBtn.addEventListener('click', clearCompleted);
        
        filterBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                filterBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentFilter = this.dataset.filter;
                renderTasks();
            });
        });
    }
    
    // Fetch tasks from backend
    async function fetchTasks() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('Failed to fetch tasks');
            tasks = await response.json();
        } catch (err) {
            console.error('Error fetching tasks:', err);
            // Fallback to localStorage if backend fails
            const localTasks = JSON.parse(localStorage.getItem('tasks')) || [];
            tasks = localTasks.map(task => ({
                ...task,
                _id: task.id || Date.now().toString()
            }));
        }
    }
    
    // Add a new task
    async function addTask() {
        const taskText = taskInput.value.trim();
        if (taskText === '') return;
        
        const newTask = {
            text: taskText,
            completed: false
        };
        
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newTask)
            });
            
            if (!response.ok) throw new Error('Failed to add task');
            
            const addedTask = await response.json();
            tasks.unshift(addedTask);
            renderTasks();
            updateTasksLeft();
            taskInput.value = '';
            taskInput.focus();
            
            // Animation for new task
            if (taskList.firstChild) {
                taskList.firstChild.style.animation = 'slideUp 0.3s ease-out';
                setTimeout(() => {
                    taskList.firstChild.style.animation = '';
                }, 300);
            }
        } catch (err) {
            console.error('Error adding task:', err);
            // Fallback to localStorage if backend fails
            newTask.id = Date.now();
            newTask.createdAt = new Date().toISOString();
            tasks.unshift(newTask);
            localStorage.setItem('tasks', JSON.stringify(tasks));
            renderTasks();
            updateTasksLeft();
            taskInput.value = '';
            taskInput.focus();
        }
    }
    
    // Render tasks based on current filter
    function renderTasks() {
        taskList.innerHTML = '';
        
        let filteredTasks = tasks;
        if (currentFilter === 'active') {
            filteredTasks = tasks.filter(task => !task.completed);
        } else if (currentFilter === 'completed') {
            filteredTasks = tasks.filter(task => task.completed);
        }
        
        if (filteredTasks.length === 0) {
            const emptyMessage = document.createElement('li');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = currentFilter === 'all' 
                ? 'No tasks yet. Add one above!' 
                : currentFilter === 'active' 
                    ? 'No active tasks!' 
                    : 'No completed tasks!';
            taskList.appendChild(emptyMessage);
            return;
        }
        
        filteredTasks.forEach(task => {
            const taskItem = document.createElement('li');
            taskItem.className = 'task-item';
            taskItem.dataset.id = task._id || task.id;
            
            taskItem.innerHTML = `
                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                <span class="task-text ${task.completed ? 'completed' : ''}">${task.text}</span>
                <div class="task-actions">
                    <button class="edit-btn"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn"><i class="fas fa-trash"></i></button>
                </div>
            `;
            
            taskList.appendChild(taskItem);
            
            // Add event listeners to the new elements
            const checkbox = taskItem.querySelector('.task-checkbox');
            const editBtn = taskItem.querySelector('.edit-btn');
            const deleteBtn = taskItem.querySelector('.delete-btn');
            const taskText = taskItem.querySelector('.task-text');
            
            checkbox.addEventListener('change', function() {
                toggleTaskComplete(task._id || task.id, this.checked);
                taskText.classList.toggle('completed', this.checked);
                updateTasksLeft();
            });
            
            editBtn.addEventListener('click', () => editTask(task._id || task.id, taskText));
            
            deleteBtn.addEventListener('click', () => deleteTask(task._id || task.id));
        });
    }
    
    // Toggle task completion status
    async function toggleTaskComplete(id, completed) {
        try {
            const response = await fetch(`${API_URL}/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ completed })
            });
            
            if (!response.ok) throw new Error('Failed to update task');
            
            const updatedTask = await response.json();
            tasks = tasks.map(task => 
                (task._id || task.id) === id ? updatedTask : task
            );
        } catch (err) {
            console.error('Error updating task:', err);
            // Fallback to localStorage if backend fails
            tasks = tasks.map(task => 
                (task._id || task.id) === id ? { ...task, completed } : task
            );
            localStorage.setItem('tasks', JSON.stringify(tasks));
        }
    }
    
    // Edit task text
    async function editTask(id, taskTextElement) {
        const currentText = taskTextElement.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'edit-input';
        
        taskTextElement.replaceWith(input);
        input.focus();
        
        async function saveEdit() {
            const newText = input.value.trim();
            if (newText && newText !== currentText) {
                try {
                    const response = await fetch(`${API_URL}/${id}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ text: newText })
                    });
                    
                    if (!response.ok) throw new Error('Failed to update task');
                    
                    const updatedTask = await response.json();
                    tasks = tasks.map(task => 
                        (task._id || task.id) === id ? updatedTask : task
                    );
                    renderTasks();
                } catch (err) {
                    console.error('Error updating task:', err);
                    // Fallback to localStorage if backend fails
                    tasks = tasks.map(task => 
                        (task._id || task.id) === id ? { ...task, text: newText } : task
                    );
                    localStorage.setItem('tasks', JSON.stringify(tasks));
                    renderTasks();
                }
            } else {
                renderTasks();
            }
        }
        
        input.addEventListener('blur', saveEdit);
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') saveEdit();
        });
    }
    
    // Delete a task
    async function deleteTask(id) {
        // Animation
        const taskItem = document.querySelector(`.task-item[data-id="${id}"]`);
        if (taskItem) {
            taskItem.style.transform = 'translateX(100%)';
            taskItem.style.opacity = '0';
            
            try {
                const response = await fetch(`${API_URL}/${id}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) throw new Error('Failed to delete task');
                
                tasks = tasks.filter(task => (task._id || task.id) !== id);
                renderTasks();
                updateTasksLeft();
            } catch (err) {
                console.error('Error deleting task:', err);
                // Fallback to localStorage if backend fails
                tasks = tasks.filter(task => (task._id || task.id) !== id);
                localStorage.setItem('tasks', JSON.stringify(tasks));
                renderTasks();
                updateTasksLeft();
            }
        }
    }
    
    // Clear all completed tasks
    async function clearCompleted() {
        try {
            const response = await fetch(API_URL, {
                method: 'DELETE'
            });
            
            if (!response.ok) throw new Error('Failed to clear completed tasks');
            
            await fetchTasks();
            renderTasks();
        } catch (err) {
            console.error('Error clearing completed tasks:', err);
            // Fallback to localStorage if backend fails
            tasks = tasks.filter(task => !task.completed);
            localStorage.setItem('tasks', JSON.stringify(tasks));
            renderTasks();
        }
    }
    
    // Update tasks left counter
    function updateTasksLeft() {
        const activeTasks = tasks.filter(task => !task.completed).length;
        tasksLeft.textContent = `${activeTasks} ${activeTasks === 1 ? 'task' : 'tasks'} left`;
    }
    
    // Initialize the app
    init();
});