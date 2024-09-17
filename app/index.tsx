import React, { useState, useEffect, useCallback } from "react";
import {
	Image,
	Text,
	ScrollView,
	View,
	Button,
	TextInput,
	Modal,
	ActivityIndicator,
	Alert,
	FlatList,
	TouchableOpacity,
	RefreshControl,
} from "react-native";
import axios from "axios";
import { Buffer } from "buffer";
import * as ImagePicker from "expo-image-picker";
import { ImagePickerAsset } from "expo-image-picker";

interface ImageInterface {
	imageName: string;
	imageUrl: string;
	sha: string;
}

interface CategoryImage {
	categoryName: string;
	images: ImageInterface[];
}

export default function HomeScreen() {
	const [data, setData] = useState<CategoryImage[]>([]);
	const [newCategoryName, setNewCategoryName] = useState("");
	const [loading, setLoading] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
	const [showSelectCategoryModal, setShowSelectCategoryModal] =
		useState(false);

	useEffect(() => {
		fetchCategories();
	}, []);

	const fetchCategories = useCallback(async () => {
		setLoading(true);
		const username = "IvanOrlovsky";
		const reponame = "forged-dragon";
		const categoryPath = "public/category";
		const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;
		console.info("Fetching categories...");

		try {
			const response = await axios.get(
				`https://api.github.com/repos/${username}/${reponame}/contents/${categoryPath}`,
				{
					headers: {
						Authorization: `token ${token}`,
					},
				}
			);
			console.info(`Fetched categories response: ${response.status}`);

			const categories = await Promise.all(
				response.data.map(async (item: any) => {
					const images = await fetchImages(item.name);
					return { categoryName: item.name, images };
				})
			);

			setData(categories);
		} catch (error) {
			Alert.alert("Ошибка", "Ошибка при получении категорий");
			console.error("Error fetching categories:", error);
		} finally {
			setLoading(false);
			setUploading(false);
			setDeleting(false);
		}
	}, []);

	const fetchImages = async (
		categoryName: string
	): Promise<ImageInterface[]> => {
		const username = "IvanOrlovsky";
		const reponame = "forged-dragon";
		const categoryPath = `public/category/${categoryName}`;
		const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;
		console.info(`Fetching images for category: ${categoryName}...`);

		try {
			const response = await axios.get(
				`https://api.github.com/repos/${username}/${reponame}/contents/${categoryPath}`,
				{
					headers: {
						Authorization: `token ${token}`,
					},
				}
			);
			console.info(`Fetched images response: ${response.status}`);

			return await Promise.all(
				response.data.map(async (image: any) => {
					const imageResponse = await axios.get(image.git_url, {
						headers: {
							Authorization: `token ${token}`,
							Accept: "application/vnd.github.VERSION.raw",
						},
						responseType: "arraybuffer",
					});
					const base64Image = Buffer.from(
						imageResponse.data,
						"binary"
					).toString("base64");
					return {
						imageName: image.name,
						imageUrl: `data:image/webp;base64,${base64Image}`,
						sha: image.sha,
					};
				})
			);
		} catch (error) {
			console.error(
				`Error fetching images for category ${categoryName}:`,
				error
			);
			return [];
		}
	};

	const pickImageFromGallery = async (selectedCategory: string) => {
		const { status } =
			await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (status !== "granted") {
			alert("Необходимо разрешение на доступ к галерее!");
			return;
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsMultipleSelection: true,
			aspect: [4, 3],
			quality: 1,
		});

		if (!result.canceled) {
			handleUploadImages(result.assets, selectedCategory);
		}
	};

	const delay = (ms: number) =>
		new Promise((resolve) => setTimeout(resolve, ms));

	const handleUploadImages = async (
		images: ImagePickerAsset[],
		selectedCategory: string
	) => {
		setUploading(true);

		const username = "IvanOrlovsky";
		const reponame = "forged-dragon";
		const categoryPath = `public/category/${selectedCategory}`;
		const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;
		let uploadedCount = 0;

		const uploadImage = async (image: ImagePickerAsset) => {
			const response = await fetch(image.uri);
			const blob = await response.blob();
			const reader = new FileReader();

			return new Promise<void>(async (resolve, reject) => {
				reader.onloadend = async () => {
					const base64data = reader.result?.toString().split(",")[1];
					const fileName = `${Date.now()}_${Math.random()
						.toString(36)
						.substring(7)}.jpg`;

					try {
						const uploadResponse = await axios.put(
							`https://api.github.com/repos/${username}/${reponame}/contents/${categoryPath}/${fileName}`,
							{
								message: `Добавление нового изображения в категорию ${selectedCategory}`,
								content: base64data,
							},
							{
								headers: {
									Authorization: `token ${token}`,
								},
							}
						);
						console.info(
							`Image upload response for ${fileName}: ${uploadResponse.status}`
						);

						if (uploadResponse.status === 201) {
							uploadedCount += 1;
							resolve();
						} else {
							throw new Error(
								`Unexpected response status for ${fileName}: ${uploadResponse.status}`
							);
						}
					} catch (uploadError) {
						console.error(
							`Error uploading image ${fileName}:`,
							uploadError
						);
						reject(uploadError);
					}
				};
				reader.onerror = (error) => reject(error);
				reader.readAsDataURL(blob);
			});
		};

		try {
			for (const image of images) {
				await uploadImage(image);
				await delay(1000); // Добавляем задержку между запросами
			}
			Alert.alert("Успех", "Все изображения успешно загружены");
		} catch (error) {
			Alert.alert(
				"Ошибка",
				"Не удалось загрузить одно или несколько изображений"
			);
			console.error("Error handling image upload:", error);
		} finally {
			setUploading(false);
			await fetchCategories(); // Обновляем список категорий сразу после загрузки
		}
	};

	const addCategory = async () => {
		if (!newCategoryName) {
			Alert.alert("Ошибка", "Нельзя давать пустое название категории");
			return;
		}

		setLoading(true);
		const username = "IvanOrlovsky";
		const reponame = "forged-dragon";
		const categoryPath = `public/category/${newCategoryName}`;
		const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;
		console.info(`Adding new category: ${newCategoryName}...`);

		// Закрыть модальное окно после ввода категории
		setShowAddCategoryModal(false);

		try {
			await axios.put(
				`https://api.github.com/repos/${username}/${reponame}/contents/${categoryPath}/.gitkeep`,
				{
					message: `Add new category ${newCategoryName}`,
					content: Buffer.from("").toString("base64"),
				},
				{
					headers: {
						Authorization: `token ${token}`,
					},
				}
			);

			Alert.alert("Успех", `Категория ${newCategoryName} добавлена`);
			setNewCategoryName("");

			// Обновляем список категорий после добавления
			setData((prev) => [
				{ categoryName: newCategoryName, images: [] },
				...prev,
			]);
		} catch (error) {
			Alert.alert("Ошибка", "Ошибка при добавлении категории");
			console.error("Error adding category:", error);
		} finally {
			setLoading(false);
		}
	};

	const deleteImage = async (
		categoryName: string,
		imageName: string,
		sha: string
	) => {
		Alert.alert(
			"Подтверждение",
			`Вы уверены, что хотите удалить изображение ${imageName}?`,
			[
				{ text: "Отмена", style: "cancel" },
				{
					text: "Удалить",
					onPress: async () => {
						setLoading(true);
						const username = "IvanOrlovsky";
						const reponame = "forged-dragon";
						const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;
						console.info(
							`Deleting image: ${imageName} from category: ${categoryName}...`
						);

						try {
							await axios.delete(
								`https://api.github.com/repos/${username}/${reponame}/contents/public/category/${categoryName}/${imageName}`,
								{
									data: {
										message: `Delete image ${imageName}`,
										sha,
									},
									headers: {
										Authorization: `token ${token}`,
									},
								}
							);

							const updatedData = data.map((category) => {
								if (category.categoryName === categoryName) {
									return {
										...category,
										images: category.images.filter(
											(image) =>
												image.imageName !== imageName
										),
									};
								}
								return category;
							});

							setData(updatedData);

							Alert.alert(
								"Успех",
								`Изображение ${imageName} удалено`
							);
						} catch (error) {
							Alert.alert(
								"Ошибка",
								"Ошибка при удалении изображения"
							);
							console.error(
								`Error deleting image ${imageName} from category ${categoryName}:`,
								error
							);
						} finally {
							setLoading(false);
						}
					},
				},
			]
		);
	};

	const deleteCategory = async (categoryName: string) => {
		Alert.alert(
			"Подтверждение",
			`Вы уверены, что хотите удалить категорию ${categoryName} и все её изображения?`,
			[
				{ text: "Отмена", style: "cancel" },
				{
					text: "Удалить",
					onPress: async () => {
						setDeleting(true);
						const username = "IvanOrlovsky";
						const reponame = "forged-dragon";
						const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;
						console.info(`Deleting category: ${categoryName}...`);

						try {
							const categoryPath = `public/category/${categoryName}`;
							const response = await axios.get(
								`https://api.github.com/repos/${username}/${reponame}/contents/${categoryPath}`,
								{
									headers: {
										Authorization: `token ${token}`,
									},
								}
							);

							// Удаляем все изображения категории
							for (let image of response.data) {
								if (image.name !== ".gitkeep") {
									await axios.delete(
										`https://api.github.com/repos/${username}/${reponame}/contents/${categoryPath}/${image.name}`,
										{
											data: {
												message: `Delete image ${image.name} in category ${categoryName}`,
												sha: image.sha,
											},
											headers: {
												Authorization: `token ${token}`,
											},
										}
									);
								}
							}

							// Удаляем саму категорию
							const gitkeepItem = response.data.find(
								(item: any) => item.name === ".gitkeep"
							);
							if (gitkeepItem) {
								await axios.delete(
									`https://api.github.com/repos/${username}/${reponame}/contents/${categoryPath}/.gitkeep`,
									{
										data: {
											message: `Delete category ${categoryName}`,
											sha: gitkeepItem.sha,
										},
										headers: {
											Authorization: `token ${token}`,
										},
									}
								);
							}

							Alert.alert(
								"Успех",
								`Категория ${categoryName} и все её изображения удалены`
							);
						} catch (error) {
							Alert.alert(
								"Ошибка",
								"Ошибка при удалении категории"
							);
							console.error(
								`Error deleting category ${categoryName}:`,
								error
							);
						} finally {
							setDeleting(false);
							// Обновляем список категорий после удаления
							await fetchCategories();
						}
					},
				},
			]
		);
	};

	const renderCategoryImages = (category: CategoryImage) => {
		return (
			<View
				key={category.categoryName}
				style={{
					marginBottom: 20,
					padding: 16,
					backgroundColor: "#C0C2C9",
					borderRadius: 16,
					flex: 1,
					flexDirection: "column",
					gap: 10,
				}}
			>
				<Text style={{ fontSize: 18, fontWeight: "bold" }}>
					{category.categoryName}
				</Text>
				<Button
					title="Удалить категорию"
					color="red"
					onPress={() => deleteCategory(category.categoryName)}
				/>
				<ScrollView horizontal>
					{category.images.map((image) => {
						if (image.imageName !== ".gitkeep") {
							return (
								<View
									key={image.imageName}
									style={{ marginRight: 10 }}
								>
									<Image
										source={{ uri: image.imageUrl }}
										style={{ width: 100, height: 100 }}
										resizeMode="cover"
									/>
									<Button
										title="Удалить"
										color="red"
										onPress={() =>
											deleteImage(
												category.categoryName,
												image.imageName,
												image.sha
											)
										}
									/>
								</View>
							);
						}
					})}
				</ScrollView>
			</View>
		);
	};

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await fetchCategories();
		setRefreshing(false);
	}, [fetchCategories]);

	return (
		<View style={{ flex: 1, gap: 8, padding: 20, marginVertical: 40 }}>
			<View style={{ flex: 1 }}>
				<Text
					style={{
						fontSize: 24,
						fontWeight: "bold",
						marginBottom: 10,
					}}
				>
					Галерея категорий
				</Text>
				{loading || deleting || uploading ? (
					<View
						style={{
							flex: 1,
							justifyContent: "center",
							alignItems: "center",
						}}
					>
						<ActivityIndicator size="large" color="#0000ff" />
						{loading && (
							<View>
								<Text>Загрузка данных сайта...</Text>
							</View>
						)}
						{uploading && (
							<View>
								<Text>Загрузка изображений...</Text>
							</View>
						)}
						{deleting && (
							<View>
								<Text>Удаление категории...</Text>
							</View>
						)}
					</View>
				) : (
					<FlatList
						data={data}
						renderItem={({ item }) => renderCategoryImages(item)}
						keyExtractor={(item) => item.categoryName}
						refreshControl={
							<RefreshControl
								refreshing={refreshing}
								onRefresh={onRefresh}
							/>
						}
					/>
				)}
			</View>

			<Button
				title="Добавить изображения"
				onPress={() => setShowSelectCategoryModal(true)}
			/>

			<Button
				title="Добавить категорию"
				onPress={() => setShowAddCategoryModal(true)}
			/>

			{/* Модальное окно добавления категории */}
			<Modal
				visible={showAddCategoryModal}
				animationType="slide"
				onRequestClose={() => setShowAddCategoryModal(false)}
				transparent
			>
				<View
					style={{
						flex: 1,
						justifyContent: "center",
						alignItems: "center",
						backgroundColor: "rgba(0,0,0,0.5)",
					}}
				>
					<View
						style={{
							width: 300,
							backgroundColor: "white",
							borderRadius: 10,
							padding: 20,
						}}
					>
						<Text>Введите название для новой категории:</Text>
						<TextInput
							value={newCategoryName}
							onChangeText={(text) =>
								setNewCategoryName(text.trim())
							}
							style={{
								borderWidth: 1,
								marginVertical: 10,
								padding: 5,
								alignSelf: "stretch",
							}}
						/>
						<TouchableOpacity
							style={{
								alignSelf: "stretch",
								borderWidth: 1,
								padding: 10,
								backgroundColor: "#4169E1",
								marginBottom: 8,
							}}
							onPress={addCategory}
						>
							<Text
								style={{ color: "white", textAlign: "center" }}
							>
								Создать
							</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={{
								borderWidth: 1,
								padding: 10,
								backgroundColor: "#4169E1",
								alignSelf: "stretch",
							}}
							onPress={() => setShowAddCategoryModal(false)}
						>
							<Text
								style={{ color: "white", textAlign: "center" }}
							>
								Закрыть
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>

			{/* Модальное окно для выбора категории куда загрузить изображение */}
			<Modal
				visible={showSelectCategoryModal}
				transparent
				animationType="slide"
			>
				<View
					style={{
						flex: 1,
						justifyContent: "center",
						alignItems: "center",
						backgroundColor: "rgba(0,0,0,0.5)",
					}}
				>
					<View
						style={{
							width: 300,
							backgroundColor: "white",
							borderRadius: 10,
							padding: 20,
						}}
					>
						<Text>
							Выберите в какую категорию загрузить изображение:
						</Text>
						<FlatList
							style={{ marginVertical: 8 }}
							data={data.map((category) => category.categoryName)}
							keyExtractor={(item) => item}
							renderItem={({ item }) => (
								<TouchableOpacity
									onPress={() => {
										pickImageFromGallery(item);
										setShowSelectCategoryModal(false);
									}}
								>
									<Text
										style={{
											padding: 10,
											fontWeight: "bold",
										}}
									>
										{item}
									</Text>
								</TouchableOpacity>
							)}
						/>

						<TouchableOpacity
							style={{
								borderWidth: 1,
								padding: 10,
								backgroundColor: "#4169E1",
							}}
							onPress={() => setShowSelectCategoryModal(false)}
						>
							<Text
								style={{ color: "white", textAlign: "center" }}
							>
								Отмена
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
		</View>
	);
}
